#include "analysis/downbeat.h"

#include <algorithm>
#include <cmath>

#include "analysis/block_fill.h"
#include "dsp/rateconversion/Decimator.h"
#include "dsp/transforms/FFT.h"
#include "maths/MathAliases.h"
#include "maths/MathUtilities.h"

namespace kitbag {

namespace {

// 16x decimation puts 44.1/48k near DownBeat's expected ~2.7kHz working rate.
// QM's Decimator tops out at 8x, so DownBeat chains 8x then 2x; so does this.
constexpr int kDecimationFactor = 16;
constexpr int kStage1Factor = 8;
constexpr int kStage2Factor = kDecimationFactor / kStage1Factor;
// Beat-grid unit, in original-rate frames, and the decimator's input block.
constexpr int kDfIncrement = 512;
constexpr int kDecimatedPerBlock = kDfIncrement / kDecimationFactor;
constexpr int kDefaultBeatsPerBar = 4;
// DownBeat's beat frame: next power of two above 1.3 s at the decimated rate.
constexpr double kBeatFrameSeconds = 1.3;
// DownBeat::measureSpecDiff compares only the lowest bins of each spectrum.
constexpr int kSpecDiffBins = 512;

std::vector<double>
BeatsToDfUnits(const std::vector<float>& beat_times, int sample_rate) {
  std::vector<double> beats;
  beats.reserve(beat_times.size());
  for (const float t : beat_times) {
    beats.push_back(
        static_cast<double>(t) * sample_rate / static_cast<double>(kDfIncrement)
    );
  }
  return beats;
}

size_t BeatFrameSize(int sample_rate) {
  const float decimated_rate =
      static_cast<float>(sample_rate) / static_cast<float>(kDecimationFactor);
  const int size = MathUtilities::nextPowerOfTwo(
      static_cast<int>(decimated_rate * kBeatFrameSeconds)
  );
  return static_cast<size_t>(std::max(size, 2));
}

// Jensen-Shannon divergence, as DownBeat::measureSpecDiff computes it.
double SpecDiff(std::vector<double> old_spec, std::vector<double> new_spec) {
  const int bins =
      std::min(kSpecDiffBins, static_cast<int>(old_spec.size()) / 4);
  double sum_new = 0.0;
  double sum_old = 0.0;
  for (int i = 0; i < bins; ++i) {
    new_spec[i] += EPS;
    old_spec[i] += EPS;
    sum_new += new_spec[i];
    sum_old += old_spec[i];
  }
  double sd = 0.0;
  for (int i = 0; i < bins; ++i) {
    new_spec[i] /= sum_new;
    old_spec[i] /= sum_old;
    if (new_spec[i] == 0) new_spec[i] = 1.0;
    if (old_spec[i] == 0) old_spec[i] = 1.0;
    const double mid = 0.5 * old_spec[i] + 0.5 * new_spec[i];
    sd = sd + (-mid * log(mid)) + (0.5 * (old_spec[i] * log(old_spec[i]))) +
         (0.5 * (new_spec[i] * log(new_spec[i])));
  }
  return sd;
}

}  // namespace

DownbeatTracker::DownbeatTracker(
    int sample_rate,
    const std::vector<float>& beat_times,
    uint64_t total_frames,
    int beats_per_bar
)
    : beats_(BeatsToDfUnits(beat_times, sample_rate)),
      beats_per_bar_(beats_per_bar > 0 ? beats_per_bar : kDefaultBeatsPerBar),
      audio_length_(
          (total_frames + kDfIncrement - 1) / kDfIncrement * kDecimatedPerBlock
      ),
      frame_size_(BeatFrameSize(sample_rate)),
      stage1_(std::make_unique<Decimator>(kDfIncrement, kStage1Factor)),
      stage2_(
          std::make_unique<Decimator>(
              kDfIncrement / kStage1Factor,
              kStage2Factor
          )
      ),
      fft_(std::make_unique<FFTReal>(static_cast<int>(frame_size_))),
      block_(kDfIncrement),
      stage1_out_(kDfIncrement / kStage1Factor),
      frame_(frame_size_),
      real_out_(frame_size_),
      imag_out_(frame_size_),
      old_spec_(frame_size_ / 2) {
  if (!std::is_sorted(beats_.begin(), beats_.end())) beats_.clear();
}

DownbeatTracker::~DownbeatTracker() = default;

void DownbeatTracker::Push(const float* mono, size_t count) {
  block_filled_ = FillBlock(mono, count, block_, block_filled_, [this] {
    PushBlock();
    return size_t{0};
  });
}

std::vector<int> DownbeatTracker::Finish() {
  if (block_filled_ > 0) {
    std::fill(block_.begin() + block_filled_, block_.end(), 0.0f);
    PushBlock();
    block_filled_ = 0;
  }
  if (beats_.size() < 2 || audio_length_ == 0) return {};
  if (next_beat_ + 1 < beats_.size()) return {};
  return PickDownbeats();
}

DownbeatTracker::BeatSpan DownbeatTracker::SpanOf(size_t beat) const {
  const double increment = kDfIncrement;
  const double factor = kDecimationFactor;
  const auto start = static_cast<size_t>((beats_[beat] * increment) / factor);
  auto end = static_cast<size_t>((beats_[beat + 1] * increment) / factor);
  if (end >= audio_length_) end = audio_length_ - 1;
  if (end < start) end = start;
  return {start, end - start};
}

void DownbeatTracker::PushBlock() {
  const size_t old_size = decimated_.size();
  decimated_.resize(old_size + kDecimatedPerBlock);
  stage1_->process(block_.data(), stage1_out_.data());
  stage2_->process(stage1_out_.data(), decimated_.data() + old_size);
  ProcessReadyBeats();
}

void DownbeatTracker::ProcessReadyBeats() {
  while (next_beat_ + 1 < beats_.size()) {
    const BeatSpan span = SpanOf(next_beat_);
    const size_t used = std::min(span.length, frame_size_);
    const size_t needed = used == 0 ? 0 : span.start + used;
    if (decimated_start_ + decimated_.size() < needed) {
      DropBefore(span.start);
      return;
    }
    ProcessBeat(span);
    ++next_beat_;
  }
  DropBefore(decimated_start_ + decimated_.size());
}

// One iteration of DownBeat::findDownBeats' beat loop, reading the beat from
// the held window rather than a whole-song buffer.
void DownbeatTracker::ProcessBeat(const BeatSpan& span) {
  const size_t used = std::min(span.length, frame_size_);
  for (size_t j = 0; j < used; ++j) {
    const double mul =
        0.5 * (1.0 - cos(TWO_PI * (double(j) / double(span.length))));
    frame_[j] = decimated_[span.start - decimated_start_ + j] * mul;
  }
  std::fill(frame_.begin() + used, frame_.end(), 0.0);
  fft_->forward(frame_.data(), real_out_.data(), imag_out_.data());

  std::vector<double> new_spec(frame_size_ / 2);
  for (size_t j = 0; j < new_spec.size(); ++j) {
    new_spec[j] =
        sqrt(real_out_[j] * real_out_[j] + imag_out_[j] * imag_out_[j]);
  }
  MathUtilities::adaptiveThreshold(new_spec);
  if (next_beat_ > 0) beat_sd_.push_back(SpecDiff(old_spec_, new_spec));
  old_spec_ = std::move(new_spec);
}

void DownbeatTracker::DropBefore(size_t position) {
  const size_t drop = std::min(
      position - std::min(position, decimated_start_),
      decimated_.size()
  );
  decimated_.erase(decimated_.begin(), decimated_.begin() + drop);
  decimated_start_ += drop;
}

// DownBeat's phase pick: the bar position whose beat transitions carry the
// greatest mean spectral change is bar-one.
std::vector<int> DownbeatTracker::PickDownbeats() const {
  const int timesig = beats_per_bar_;
  std::vector<double> candidates(timesig, 0.0);
  for (int beat = 0; beat < timesig; ++beat) {
    int count = 0;
    for (int ex = beat - 1; ex < static_cast<int>(beat_sd_.size());
         ex += timesig) {
      if (ex < 0) continue;
      candidates[beat] += beat_sd_[ex] / timesig;
      ++count;
    }
    if (count > 0) candidates[beat] /= count;
  }
  std::vector<int> downbeats;
  const int first = MathUtilities::getMax(candidates);
  for (int i = first; i < static_cast<int>(beats_.size()); i += timesig) {
    downbeats.push_back(i);
  }
  return downbeats;
}

}  // namespace kitbag
