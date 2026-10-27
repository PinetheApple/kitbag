#include "onset_detector.h"

#include <algorithm>
#include <cmath>

#include "click_soak_types.h"
#include "metronome/metronome_internal.h"
#include "soak_stats.h"

namespace click_soak {

namespace {

using kitbag::metronome_detail::kMsPerSecond;

size_t FramesIn(double ms, uint32_t sample_rate) {
  const double frames = std::round(ms * sample_rate / kMsPerSecond);
  return std::max<size_t>(1, static_cast<size_t>(frames));
}

std::vector<float>
WindowPeaks(const std::vector<float>& block_peaks, size_t window_blocks) {
  std::vector<float> windows;
  for (size_t start = 0; start < block_peaks.size(); start += window_blocks) {
    const size_t end = std::min(block_peaks.size(), start + window_blocks);
    windows.push_back(*std::max_element(
        block_peaks.begin() + static_cast<std::ptrdiff_t>(start),
        block_peaks.begin() + static_cast<std::ptrdiff_t>(end)
    ));
  }
  return windows;
}

}  // namespace

BlockPeakMeter::BlockPeakMeter(uint32_t sample_rate)
    : block_frames_(FramesIn(kNoiseBlockMs, sample_rate)) {}

void BlockPeakMeter::Feed(const float* mono, size_t count) {
  for (size_t i = 0; i < count; ++i) {
    peak_ = std::max(peak_, std::fabs(mono[i]));
    if (++filled_ == block_frames_) {
      peaks_.push_back(peak_);
      peak_ = 0.0F;
      filled_ = 0;
    }
  }
}

std::vector<float> BlockPeakMeter::Finish() {
  if (filled_ > 0) peaks_.push_back(peak_);
  filled_ = 0;
  peak_ = 0.0F;
  return std::move(peaks_);
}

DetectionLevels EstimateLevels(
    const std::vector<float>& block_peaks,
    size_t block_frames,
    uint32_t sample_rate,
    double beat_sec
) {
  DetectionLevels levels;
  if (block_peaks.empty()) return levels;
  const double beat_frames = beat_sec * sample_rate;
  const auto window_blocks = std::max<size_t>(
      1,
      static_cast<size_t>(
          std::round(beat_frames / static_cast<double>(block_frames))
      )
  );
  levels.noise_floor = Quantile(block_peaks, kNoisePercentile);
  const double gate = kNoiseMargin * levels.noise_floor;
  std::vector<float> windows = WindowPeaks(block_peaks, window_blocks);
  std::erase_if(windows, [gate](float peak) { return peak <= gate; });
  if (windows.empty()) return levels;
  levels.click_peak = UpperMedian(windows);
  levels.threshold = std::max(kDetectFraction * levels.click_peak, gate);
  return levels;
}

OnsetDetector::OnsetDetector(
    uint32_t sample_rate,
    const DetectionLevels& levels
)
    : sample_rate_(sample_rate),
      release_(
          std::exp(
              -1.0 /
              static_cast<double>(FramesIn(kEnvelopeReleaseMs, sample_rate))
          )
      ),
      threshold_(levels.threshold),
      rearm_level_(kRearmFraction * levels.threshold),
      onset_level_(kOnsetFraction * levels.click_peak),
      history_(FramesIn(kOnsetLookbackMs, sample_rate), 0.0) {}

void OnsetDetector::Feed(const float* mono, size_t count) {
  for (size_t i = 0; i < count; ++i) Step(mono[i]);
}

double OnsetDetector::EnvelopeAt(int64_t frame) const {
  const auto size = static_cast<int64_t>(history_.size());
  return history_[static_cast<size_t>(frame % size)];
}

void OnsetDetector::Step(float sample) {
  envelope_ =
      std::max(static_cast<double>(std::fabs(sample)), envelope_ * release_);
  history_[static_cast<size_t>(
      frame_ % static_cast<int64_t>(history_.size())
  )] = envelope_;
  if (armed_ && envelope_ >= threshold_) {
    onsets_sec_.push_back(
        static_cast<double>(FirstFrameOfAttack()) / sample_rate_
    );
    armed_ = false;
  } else if (!armed_ && envelope_ < rearm_level_) {
    armed_ = true;
  }
  ++frame_;
}

// Walks back while the envelope is still rising and above the onset level;
// stopping on a non-rise keeps a previous click's tail out of the attack.
int64_t OnsetDetector::FirstFrameOfAttack() const {
  const auto lookback = static_cast<int64_t>(history_.size()) - 1;
  const int64_t earliest = std::max<int64_t>(0, frame_ - lookback);
  int64_t frame = frame_;
  while (frame > earliest) {
    const double before = EnvelopeAt(frame - 1);
    if (before < onset_level_ || before >= EnvelopeAt(frame)) break;
    --frame;
  }
  return frame;
}

std::vector<double> DetectOnsets(
    const std::vector<float>& mono,
    uint32_t sample_rate,
    double beat_sec,
    DetectionLevels* levels
) {
  BlockPeakMeter meter(sample_rate);
  meter.Feed(mono.data(), mono.size());
  const size_t block_frames = meter.block_frames();
  *levels = EstimateLevels(meter.Finish(), block_frames, sample_rate, beat_sec);
  if (levels->click_peak <= 0.0) return {};
  OnsetDetector detector(sample_rate, *levels);
  detector.Feed(mono.data(), mono.size());
  return detector.onsets_sec();
}

}  // namespace click_soak
