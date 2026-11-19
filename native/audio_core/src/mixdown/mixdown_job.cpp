#include "mixdown/mixdown_job.h"

#include <algorithm>
#include <cmath>
#include <filesystem>
#include <system_error>
#include <utility>

#if defined(__linux__)
#include <sys/resource.h>
#endif

namespace kitbag {
namespace {

constexpr FrameClock kNoClock{0};
constexpr bool kEngineStopped = false;

std::optional<uint64_t> VolumeFreeBytes(const std::string& dir) {
  std::error_code error;
  const std::filesystem::space_info space = std::filesystem::space(dir, error);
  if (error) return std::nullopt;
  return space.available;
}

// Linux nice is per thread, and who = 0 names the calling thread alone.
void LowerThreadPriority() {
#if defined(__linux__)
  setpriority(PRIO_PROCESS, 0, MixdownJob::kBackgroundNice);
#endif
}

uint64_t OutputFrames(const MixSnapshot& snapshot) {
  return static_cast<uint64_t>(std::ceil(
      static_cast<double>(snapshot.longest_frames) /
      static_cast<double>(snapshot.rate)
  ));
}

}  // namespace

MixdownJob::MixdownJob(uint32_t engine_rate)
    : engine_rate_(engine_rate), free_bytes_(VolumeFreeBytes) {}

MixdownJob::~MixdownJob() {
  Cancel();
  if (worker_.joinable()) worker_.join();
}

void MixdownJob::set_free_bytes(FreeBytes free_bytes) {
  free_bytes_ = std::move(free_bytes);
}

void MixdownJob::set_stall_timeout(std::chrono::milliseconds timeout) {
  stall_timeout_ = timeout;
}

MixdownJob::StartResult
MixdownJob::Start(const MixSnapshot& snapshot, const std::string& path) {
  const std::lock_guard<std::mutex> lock(start_mutex_);
  if (state() == State::kRunning) return StartResult::kBusy;
  if (worker_.joinable()) worker_.join();
  const StartResult refusal = Refusal(snapshot, path);
  if (refusal != StartResult::kOk) return refusal;
  written_frames_.store(0, std::memory_order_relaxed);
  expected_frames_.store(OutputFrames(snapshot), std::memory_order_relaxed);
  cancel_.store(false, std::memory_order_relaxed);
  state_.store(State::kRunning, std::memory_order_release);
  worker_ = std::thread([this, snapshot, path] { Run(snapshot, path); });
  return StartResult::kOk;
}

MixdownJob::StartResult MixdownJob::Refusal(
    const MixSnapshot& snapshot,
    const std::string& path
) const {
  if (snapshot.tracks.empty()) return StartResult::kInvalid;
  const uint64_t frames = OutputFrames(snapshot);
  if (frames > WavWriter::MaxFrames()) return StartResult::kTooLong;
  if (!HasRoom(path, frames)) return StartResult::kNoSpace;
  return StartResult::kOk;
}

bool MixdownJob::HasRoom(const std::string& path, uint64_t frames) const {
  std::filesystem::path dir = std::filesystem::path(path).parent_path();
  if (dir.empty()) dir = std::filesystem::current_path();
  const std::optional<uint64_t> free = free_bytes_(dir.string());
  if (!free) return true;
  return *free >= WavWriter::FileBytes(frames) + kSpaceMarginBytes;
}

void MixdownJob::Cancel() {
  cancel_.store(true, std::memory_order_relaxed);
}

double MixdownJob::progress() const {
  if (state() == State::kDone) return 1.0;
  const uint64_t expected = expected_frames_.load(std::memory_order_relaxed);
  if (expected == 0) return 0.0;
  const auto written =
      static_cast<double>(written_frames_.load(std::memory_order_relaxed));
  return std::min(1.0, written / static_cast<double>(expected));
}

void MixdownJob::Run(const MixSnapshot& snapshot, const std::string& path) {
  LowerThreadPriority();
  const State end = Prepare(snapshot, path) ? Render() : Stopped();
  if (end != State::kDone) writer_.Abort();
  mixer_.reset();
  state_.store(end, std::memory_order_release);
}

bool MixdownJob::Prepare(const MixSnapshot& snapshot, const std::string& path) {
  mixer_ = std::make_unique<Mixer>(engine_rate_);
  mixer_->ReserveCallbackFrames(kBlockFrames);
  block_.assign(static_cast<size_t>(kBlockFrames) * WavWriter::kChannels, 0.0f);
  if (!LoadStems(*mixer_, snapshot)) return false;
  ApplyLevels(*mixer_, snapshot);
  if (!PrimeStretch(*mixer_, snapshot)) return false;
  return writer_.Open(path, engine_rate_, kBlockFrames);
}

bool MixdownJob::LoadStems(Mixer& mixer, const MixSnapshot& snapshot) {
  for (size_t t = 0; t < snapshot.tracks.size(); ++t) {
    const TrackSnapshot& track = snapshot.tracks[t];
    const auto index = static_cast<int>(t);
    const Mixer::LoadResult result =
        track.path.empty()
            ? mixer
                  .SetTrackSource(index, track.reader, kNoClock, kEngineStopped)
            : mixer.LoadTrack(
                  index,
                  track.path.c_str(),
                  kNoClock,
                  kEngineStopped
              );
    if (result != Mixer::LoadResult::kOk) return false;
  }
  return true;
}

// Drained before the stretch primes, which reads the levels.
void MixdownJob::ApplyLevels(Mixer& mixer, const MixSnapshot& snapshot) {
  for (size_t t = 0; t < snapshot.tracks.size(); ++t) {
    const TrackSnapshot& track = snapshot.tracks[t];
    const auto index = static_cast<int>(t);
    mixer.SetGain(index, track.gain);
    mixer.SetMute(index, track.mute);
    mixer.SetSolo(index, track.solo);
  }
  mixer.SetMasterGain(snapshot.master_gain);
  mixer.Process(block_.data(), 0, 0);
}

bool MixdownJob::PrimeStretch(Mixer& mixer, const MixSnapshot& snapshot) {
  for (size_t t = 0; t < snapshot.tracks.size(); ++t) {
    const int pitch = snapshot.tracks[t].pitch;
    if (pitch == 0) continue;
    const auto result = mixer.SetTrackPitch(
        static_cast<int>(t),
        static_cast<float>(pitch),
        kNoClock,
        kEngineStopped
    );
    if (result != Mixer::StretchResult::kOk) return false;
  }
  if (snapshot.rate == kUnityRate) return true;
  return mixer.SetRate(snapshot.rate, kNoClock, kEngineStopped) ==
         Mixer::StretchResult::kOk;
}

MixdownJob::State MixdownJob::Render() {
  mixer_->Play();
  do {
    if (!WaitForReadAhead() || !WriteBlock()) return Stopped();
  } while (mixer_->is_playing());
  if (cancel_.load(std::memory_order_relaxed)) return State::kCancelled;
  if (writer_.frames() == 0) return State::kFailed;
  return writer_.Finish() ? State::kDone : State::kFailed;
}

MixdownJob::State MixdownJob::Stopped() const {
  return cancel_.load(std::memory_order_relaxed) ? State::kCancelled
                                                 : State::kFailed;
}

bool MixdownJob::WaitForReadAhead() {
  const auto deadline = std::chrono::steady_clock::now() + stall_timeout_;
  for (int t = 0; t < mixer_->active_track_count(); ++t) {
    while (!TrackReady(t)) {
      if (cancel_.load(std::memory_order_relaxed)) return false;
      if (std::chrono::steady_clock::now() > deadline) return false;
      std::this_thread::sleep_for(kReadAheadPoll);
    }
  }
  return !cancel_.load(std::memory_order_relaxed);
}

bool MixdownJob::TrackReady(int track) const {
  return mixer_->track_buffered(track) >= kBlockFrames ||
         mixer_->track_input_done(track);
}

bool MixdownJob::WriteBlock() {
  mixer_->Process(block_.data(), kBlockFrames, 0);
  const SongClock& clock = mixer_->song_clock();
  if (!clock.playing) return true;
  const float* audible =
      block_.data() +
      static_cast<size_t>(clock.start_index) * WavWriter::kChannels;
  if (!writer_.Write(audible, clock.frames)) return false;
  written_frames_.store(writer_.frames(), std::memory_order_relaxed);
  return true;
}

}  // namespace kitbag
