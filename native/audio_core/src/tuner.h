#ifndef KITBAG_TUNER_H
#define KITBAG_TUNER_H

#include <atomic>
#include <cstdint>
#include <thread>

#include "miniaudio.h"
#include "pitch_analyzer.h"
#include "spsc_ring.h"

namespace kitbag {

// Mic-driven tuner. Owns its own capture device (separate from the playback
// engine): the capture callback only pushes raw samples into a lock-free
// ring; a non-RT analysis thread runs the PitchAnalyzer and publishes the
// latest reading through atomics that the UI polls on its vsync ticker.
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

  // The whole reading in one atomic — a single load can never pair note A
  // with note B's cents. Layout mirrored by kb_tuner_snapshot:
  //   bits 0-15   int16   nearest-note MIDI index (-1 = no pitch)
  //   bits 16-31  int16   cents offset from that note, x100
  //   bits 32-47  uint16  confidence [0,1] x10000
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

#endif  // KITBAG_TUNER_H
