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

  bool is_running() const { return running_.load(std::memory_order_relaxed); }
  double pitch_hz() const { return pitch_hz_.load(std::memory_order_relaxed); }
  double cents() const { return cents_.load(std::memory_order_relaxed); }
  double confidence() const {
    return confidence_.load(std::memory_order_relaxed);
  }
  int32_t note_index() const {
    return note_index_.load(std::memory_order_relaxed);
  }

 private:
  // ~340ms of headroom at 48kHz between callback and analysis thread.
  static constexpr size_t kRingCapacity = 16384;
  static constexpr int kIdleSleepMicros = 2000;

  static void DataCallback(ma_device* device, void* output, const void* input,
                           ma_uint32 frame_count);
  void AnalysisLoop();
  void PublishReading(const PitchAnalyzer::Reading& reading);

  ma_device device_{};
  bool device_ready_ = false;
  std::thread analysis_thread_;

  SpscRing<float, kRingCapacity> samples_;

  std::atomic<bool> running_{false};
  std::atomic<double> a4_hz_{PitchAnalyzer::kDefaultA4Hz};
  std::atomic<double> band_low_hz_{PitchAnalyzer::kChromaticLowHz};
  std::atomic<double> band_high_hz_{PitchAnalyzer::kChromaticHighHz};
  std::atomic<uint32_t> params_version_{0};

  std::atomic<double> pitch_hz_{0.0};
  std::atomic<double> cents_{0.0};
  std::atomic<double> confidence_{0.0};
  std::atomic<int32_t> note_index_{-1};
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_H
