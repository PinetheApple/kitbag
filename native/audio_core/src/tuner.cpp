#include "tuner.h"

#include <algorithm>
#include <chrono>
#include <cmath>

namespace kitbag {

uint64_t Tuner::PackSnapshot(const PitchAnalyzer::Reading& reading) {
  const auto note = static_cast<uint16_t>(
      static_cast<int16_t>(std::clamp(reading.note_index, -1, 32767))
  );
  const auto cents = static_cast<uint16_t>(static_cast<int16_t>(
      std::lround(std::clamp(reading.cents, -320.0, 320.0) * 100.0)
  ));
  const auto confidence = static_cast<uint16_t>(
      std::lround(std::clamp(reading.confidence, 0.0, 1.0) * 10000.0)
  );
  return static_cast<uint64_t>(note) | (static_cast<uint64_t>(cents) << 16) |
         (static_cast<uint64_t>(confidence) << 32);
}

Tuner::~Tuner() {
  Stop();
}

bool Tuner::Start() {
  if (running_.load(std::memory_order_relaxed)) {
    return true;
  }

  ma_device_config config = ma_device_config_init(ma_device_type_capture);
  config.capture.format = ma_format_f32;
  config.capture.channels = 1;
  config.sampleRate = kSampleRate;
  config.dataCallback = DataCallback;
  config.pUserData = this;
  // Raw mic path: never AGC/NS/AEC on a tuner signal (SPEC.md §10.1). AAudio
  // honors this; other backends ignore the field.
  config.aaudio.inputPreset = ma_aaudio_input_preset_unprocessed;

  if (ma_device_init(nullptr, &config, &device_) != MA_SUCCESS) {
    return false;
  }
  device_ready_ = true;

  if (ma_device_start(&device_) != MA_SUCCESS) {
    ma_device_uninit(&device_);
    device_ready_ = false;
    return false;
  }

  running_.store(true, std::memory_order_relaxed);
  analysis_thread_ = std::thread(&Tuner::AnalysisLoop, this);
  return true;
}

void Tuner::Stop() {
  if (!running_.exchange(false, std::memory_order_relaxed)) {
    return;
  }
  if (analysis_thread_.joinable()) {
    analysis_thread_.join();
  }
  if (device_ready_) {
    ma_device_uninit(&device_);
    device_ready_ = false;
  }
  snapshot_.store(
      PackSnapshot(PitchAnalyzer::Reading{}),
      std::memory_order_relaxed
  );
}

void Tuner::SetA4(double a4_hz) {
  a4_hz_.store(a4_hz, std::memory_order_relaxed);
  params_version_.fetch_add(1, std::memory_order_release);
}

void Tuner::SetBand(double low_hz, double high_hz) {
  band_low_hz_.store(low_hz, std::memory_order_relaxed);
  band_high_hz_.store(high_hz, std::memory_order_relaxed);
  params_version_.fetch_add(1, std::memory_order_release);
}

void Tuner::DataCallback(
    ma_device* device,
    void* output,
    const void* input,
    ma_uint32 frame_count
) {
  (void)output;
  auto* tuner = static_cast<Tuner*>(device->pUserData);
  const auto* samples = static_cast<const float*>(input);
  for (ma_uint32 frame = 0; frame < frame_count; ++frame) {
    // Dropped samples on a full ring are fine: the analyzer re-settles and
    // the callback must never block.
    tuner->samples_.Push(samples[frame]);
  }
}

void Tuner::ApplyParamChanges(
    PitchAnalyzer* analyzer,
    uint32_t* applied_version
) {
  const uint32_t version = params_version_.load(std::memory_order_acquire);
  if (version == *applied_version) return;
  *applied_version = version;

  analyzer->SetA4(a4_hz_.load(std::memory_order_relaxed));
  const double low = band_low_hz_.load(std::memory_order_relaxed);
  const double high = band_high_hz_.load(std::memory_order_relaxed);
  // SetBand rebuilds the detector and drops the lock, so only on a real change.
  if (low != analyzer->band_low_hz() || high != analyzer->band_high_hz()) {
    analyzer->SetBand(low, high);
  }
}

// Returns false when the ring was already empty.
bool Tuner::DrainAndAnalyze(PitchAnalyzer* analyzer) {
  float sample = 0.0f;
  bool drained_any = false;
  while (samples_.Pop(&sample)) {
    drained_any = true;
    if (analyzer->Process(sample)) {
      snapshot_.store(
          PackSnapshot(analyzer->reading()),
          std::memory_order_relaxed
      );
    }
  }
  return drained_any;
}

void Tuner::AnalysisLoop() {
  // Version captured BEFORE the params are read: a Set* landing in between
  // bumps it and gets re-applied next pass instead of being silently dropped.
  uint32_t applied_version = params_version_.load(std::memory_order_acquire);
  PitchAnalyzer analyzer(
      kSampleRate,
      band_low_hz_.load(std::memory_order_relaxed),
      band_high_hz_.load(std::memory_order_relaxed)
  );
  analyzer.SetA4(a4_hz_.load(std::memory_order_relaxed));

  while (running_.load(std::memory_order_relaxed)) {
    ApplyParamChanges(&analyzer, &applied_version);
    if (!DrainAndAnalyze(&analyzer)) {
      std::this_thread::sleep_for(std::chrono::microseconds(kIdleSleepMicros));
    }
  }
}

}  // namespace kitbag
