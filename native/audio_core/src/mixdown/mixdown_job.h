#ifndef KITBAG_MIXDOWN_MIXDOWN_JOB_H
#define KITBAG_MIXDOWN_MIXDOWN_JOB_H

#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#include "media/streaming_track.h"
#include "mixdown/wav_writer.h"
#include "mixer/mixer.h"
#include "mixer/mixer_snapshot.h"

namespace kitbag {

// Renders through a private Mixer, so the live one and the audio callback
// never see it.
class MixdownJob {
 public:
  enum class State : int32_t { kIdle, kRunning, kDone, kFailed, kCancelled };
  enum class StartResult : uint8_t { kOk, kBusy, kInvalid, kNoSpace, kTooLong };
  using FreeBytes = std::function<std::optional<uint64_t>(const std::string&)>;

  static constexpr uint32_t kBlockFrames = StreamingTrack::kMaxBlockFrames;
  static constexpr uint64_t kSpaceMarginBytes = 64ULL * 1024 * 1024;
  static constexpr std::chrono::milliseconds kStallTimeout{5000};
  static constexpr auto kReadAheadPoll = std::chrono::microseconds(500);
  static constexpr int kBackgroundNice = 10;

  explicit MixdownJob(uint32_t engine_rate);
  ~MixdownJob();
  MixdownJob(const MixdownJob&) = delete;
  MixdownJob& operator=(const MixdownJob&) = delete;

  StartResult Start(const MixSnapshot& snapshot, const std::string& path);
  void Cancel();
  State state() const {
    return state_.load(std::memory_order_acquire);
  }
  double progress() const;
  /// Tests only: the volume query behind the space check.
  void set_free_bytes(FreeBytes free_bytes);
  /// Tests only.
  void set_stall_timeout(std::chrono::milliseconds timeout);

 private:
  StartResult
  Refusal(const MixSnapshot& snapshot, const std::string& path) const;
  bool HasRoom(const std::string& path, uint64_t frames) const;
  void Run(const MixSnapshot& snapshot, const std::string& path);
  bool Prepare(const MixSnapshot& snapshot, const std::string& path);
  bool LoadStems(Mixer& mixer, const MixSnapshot& snapshot);
  void ApplyLevels(Mixer& mixer, const MixSnapshot& snapshot);
  static bool PrimeStretch(Mixer& mixer, const MixSnapshot& snapshot);
  State Render();
  State Stopped() const;
  bool WaitForReadAhead();
  bool TrackReady(int track) const;
  bool WriteBlock();

  uint32_t engine_rate_;
  std::mutex start_mutex_;
  std::thread worker_;
  std::unique_ptr<Mixer> mixer_;
  WavWriter writer_;
  std::vector<float> block_;
  FreeBytes free_bytes_;
  std::chrono::milliseconds stall_timeout_ = kStallTimeout;
  std::atomic<State> state_{State::kIdle};
  std::atomic<bool> cancel_{false};
  std::atomic<uint64_t> written_frames_{0};
  std::atomic<uint64_t> expected_frames_{0};
};

}  // namespace kitbag

#endif  // KITBAG_MIXDOWN_MIXDOWN_JOB_H
