#ifndef KITBAG_TUNER_TUNER_H
#define KITBAG_TUNER_TUNER_H

#include "kitbag_api.h"

#include <array>
#include <atomic>
#include <cstdint>
#include <thread>

#include "miniaudio.h"
#include "rt/spsc_ring.h"
#include "tuner/tuner_state_mirror.h"
#include "tuner/tuning_mode.h"

namespace kitbag {

// The capture callback only pushes samples to a ring. One TuningMode does all
// analysis; kb_tuner_snapshot is its reading reduced to the nearest note.
// Thread contract: kitbag_tuner_api.h.
class Tuner {
 public:
  static constexpr uint32_t kSampleRate = 48000;

  Tuner() = default;
  ~Tuner();

  Tuner(const Tuner&) = delete;
  Tuner& operator=(const Tuner&) = delete;

  // Opens the mic (raw/unprocessed where the backend allows) and starts the
  // analysis thread. Idempotent.
  bool Start();
  void Stop();

  // App thread. Configuration is validated here, so INVALID_ARGUMENT is final;
  // a valid call is queued, and BUSY means the queue was full.
  kb_result SetA4(double a4_hz);
  kb_result SetBand(double low_hz, double high_hz);
  kb_result
  SetTuning(int32_t instrument, const int32_t* string_midis, int32_t count);
  kb_result SetTargetString(int32_t string_index);
  kb_result SetChromatic();
  kb_result ResetNotePresence(double pause_ms);

  // Any thread.
  bool is_running() const {
    return analysis_owned_.load(std::memory_order_acquire);
  }
  uint64_t snapshot() const {
    return snapshot_.load(std::memory_order_relaxed);
  }
  kb_tuner_state tuning_state() const {
    return state_mirror_.Load();
  }

  // Bit layout and scaling: SPEC.md §13.2, kb_tuner_snapshot.
  static uint64_t PackSnapshot(const kb_tuner_state& state, double clarity);

  // App thread, mic off: the verify-only offline drive.
  bool OfflineInit(uint32_t sample_rate);
  void OfflineProcess(const float* samples, uint32_t frame_count);

 private:
  // ~340ms of headroom at 48kHz between callback and analysis thread.
  static constexpr size_t kRingCapacity = 16384;
  static constexpr int kIdleSleepMicros = 2000;
  static constexpr size_t kCommandCapacity = 32;
  static constexpr size_t kDrainBlock = 256;

  struct TuningCommand {
    enum class Kind {
      kSetTuning,
      kSetTarget,
      kSetChromatic,
      kSetBand,
      kSetA4,
      kReset
    };
    Kind kind = Kind::kReset;
    int32_t instrument = 0;
    int32_t count = 0;
    std::array<int32_t, KB_TUNER_MAX_STRINGS> midis{};
    int32_t target = KB_TUNER_AUTO_STRING;
    double value = 0.0;
    double high = 0.0;
  };
  using DrainBlock = std::array<float, kDrainBlock>;

  static void DataCallback(
      ma_device* device,
      void* output,
      const void* input,
      ma_uint32 frame_count
  );
  bool OpenDevice();
  size_t FillBlock(DrainBlock* block);
  bool DrainAndAnalyze();
  void AnalysisLoop();
  void Analyse(const float* samples, uint32_t frame_count);
  void Publish();
  kb_result SendCommand(const TuningCommand& command);
  void ApplyCommands();
  void ApplyCommand(const TuningCommand& command);

  ma_device device_{};
  bool device_ready_ = false;
  std::thread analysis_thread_;

  SpscRing<float, kRingCapacity> samples_;
  SpscRing<TuningCommand, kCommandCapacity> commands_;

  // running_ asks the analysis thread to keep going. analysis_owned_ says it
  // owns tuning_mode_; Stop clears it only after the join.
  std::atomic<bool> running_{false};
  std::atomic<bool> analysis_owned_{false};

  // App thread: bounds kb_tuner_set_target_string.
  int32_t app_string_count_ = 0;
  TuningMode tuning_mode_;
  std::atomic<uint64_t> snapshot_{PackSnapshot(TuningMode::RestState(), 0.0)};
  TunerStateMirror state_mirror_{TuningMode::RestState()};
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_TUNER_H
