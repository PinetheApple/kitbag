#ifndef KITBAG_TUNER_TUNER_H
#define KITBAG_TUNER_TUNER_H

#include <atomic>
#include <cstdint>
#include <thread>

#include "miniaudio.h"
#include "rt/spsc_ring.h"
#include "tuner/pitch_analyzer.h"

namespace kitbag {

// Mic-driven tuner owning its own capture device: the callback only pushes raw
// samples to a lock-free ring; a non-RT thread analyzes and publishes atomics.
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

  // Thread-safe; picked up by the analysis thread between blocks.
  void SetA4(double a4_hz);
  void SetBand(double low_hz, double high_hz);

  bool is_running() const {
    return running_.load(std::memory_order_relaxed);
  }

  // The whole reading in one atomic — a single load can never pair note A with
  // note B's cents. Bit layout and scaling: SPEC.md §13.2, kb_tuner_snapshot.
  uint64_t snapshot() const {
    return snapshot_.load(std::memory_order_relaxed);
  }

  static uint64_t PackSnapshot(const PitchAnalyzer::Reading& reading);

 private:
  // ~340ms of headroom at 48kHz between callback and analysis thread.
  static constexpr size_t kRingCapacity = 16384;
  static constexpr int kIdleSleepMicros = 2000;

  static void DataCallback(
      ma_device* device,
      void* output,
      const void* input,
      ma_uint32 frame_count
  );
  void ApplyParamChanges(PitchAnalyzer* analyzer, uint32_t* applied_version);
  bool DrainAndAnalyze(PitchAnalyzer* analyzer);
  void AnalysisLoop();

  ma_device device_{};
  bool device_ready_ = false;
  std::thread analysis_thread_;

  SpscRing<float, kRingCapacity> samples_;

  std::atomic<bool> running_{false};
  std::atomic<double> a4_hz_{PitchAnalyzer::kDefaultA4Hz};
  std::atomic<double> band_low_hz_{PitchAnalyzer::kChromaticLowHz};
  std::atomic<double> band_high_hz_{PitchAnalyzer::kChromaticHighHz};
  std::atomic<uint32_t> params_version_{0};

  std::atomic<uint64_t> snapshot_{PackSnapshot(PitchAnalyzer::Reading{})};
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_TUNER_H
