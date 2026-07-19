#include "engine.h"

#include <cmath>

namespace kitbag {

namespace {
constexpr double kTau = 6.283185307179586;
constexpr float kToneAmplitude = 0.2f;
}  // namespace

Engine::~Engine() {
  Stop();
  if (device_ready_) {
    ma_device_uninit(&device_);
  }
}

bool Engine::Init() {
  ma_device_config config = ma_device_config_init(ma_device_type_playback);
  config.playback.format = ma_format_f32;
  config.playback.channels = kChannelCount;
  config.sampleRate = kSampleRate;
  config.dataCallback = DataCallback;
  config.pUserData = this;

  if (ma_device_init(nullptr, &config, &device_) != MA_SUCCESS) {
    return false;
  }
  device_ready_ = true;
  return true;
}

bool Engine::Start() {
  if (!device_ready_) {
    return false;
  }
  const bool started = ma_device_start(&device_) == MA_SUCCESS;
  // Set only after the device is live, so a publisher that reads this can never
  // conclude "no reader" while the callback is already running.
  device_running_.store(started, std::memory_order_relaxed);
  return started;
}

void Engine::Stop() {
  if (device_ready_) {
    ma_device_stop(&device_);
  }
  // ma_device_stop blocks until the callback has returned, so from here on
  // there is no reader.
  device_running_.store(false, std::memory_order_relaxed);
  // The callback is stopped, so grids retired while the clock was not
  // advancing can be freed now. Nothing else ever reclaims them: Collect only
  // frees as frames_rendered_ moves, and a stopped engine never moves it.
  metronome_.ReleaseRetiredGrids();
}

void Engine::SetTestTone(bool enabled, float frequency_hz) {
  if (frequency_hz > 0.0f) {
    tone_frequency_hz_.store(frequency_hz, std::memory_order_relaxed);
  }
  tone_enabled_.store(enabled, std::memory_order_relaxed);
}

void Engine::DataCallback(ma_device* device, void* output, const void* input,
                          ma_uint32 frame_count) {
  (void)input;
  auto* engine = static_cast<Engine*>(device->pUserData);
  engine->Render(static_cast<float*>(output), frame_count);
}

void Engine::Render(float* output, uint32_t frame_count) {
  // The engine-clock frame of output[0]: the shared transport, read before the
  // block and advanced once after it. Metronome anchoring (StartAt, and the
  // grid/external anchors to come) is expressed against this frame.
  const uint64_t block_start_frame =
      frames_rendered_.load(std::memory_order_relaxed);

  const bool tone_on = tone_enabled_.load(std::memory_order_relaxed);
  const double phase_step =
      kTau * tone_frequency_hz_.load(std::memory_order_relaxed) / kSampleRate;

  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    float sample = 0.0f;
    if (tone_on) {
      sample = kToneAmplitude * static_cast<float>(std::sin(tone_phase_));
      tone_phase_ += phase_step;
      if (tone_phase_ >= kTau) {
        tone_phase_ -= kTau;
      }
    }
    for (uint32_t channel = 0; channel < kChannelCount; ++channel) {
      output[frame * kChannelCount + channel] = sample;
    }
  }

  // Must precede the metronome: Process() memsets the buffer rather than
  // accumulating, so anything written above it (including the test tone) is
  // discarded.
  mixer_.Process(output, frame_count, kSampleRate);

  metronome_.Render(output, frame_count, kSampleRate, kChannelCount,
                    block_start_frame);

  frames_rendered_.fetch_add(frame_count, std::memory_order_relaxed);
}

}  // namespace kitbag
