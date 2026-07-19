#ifndef KITBAG_ENGINE_H
#define KITBAG_ENGINE_H

#include <atomic>
#include <cstdint>

#include "decoder.h"
#include "metronome.h"
#include "miniaudio.h"
#include "mixer.h"
#include "tuner.h"

namespace kitbag {

// Realtime audio engine. Owns the output device; the data callback is the
// realtime thread — everything it touches must stay lock- and allocation-free.
class Engine {
 public:
  static constexpr uint32_t kSampleRate = 48000;
  static constexpr uint32_t kChannelCount = 2;
  static constexpr float kDefaultToneFrequencyHz = 440.0f;  // A4 test tone

  Engine() = default;
  ~Engine();

  Engine(const Engine&) = delete;
  Engine& operator=(const Engine&) = delete;

  bool Init();
  bool Start();
  void Stop();

  uint32_t sample_rate() const { return kSampleRate; }
  uint64_t frames_rendered() const {
    return frames_rendered_.load(std::memory_order_relaxed);
  }

  void SetTestTone(bool enabled, float frequency_hz);

  Metronome& metronome() { return metronome_; }
  const Metronome& metronome() const { return metronome_; }

  Tuner& tuner() { return tuner_; }
  const Tuner& tuner() const { return tuner_; }

  Decoder& decoder() { return decoder_; }
  const Decoder& decoder() const { return decoder_; }

  Mixer& mixer() { return mixer_; }
  const Mixer& mixer() const { return mixer_; }

 private:
  static void DataCallback(ma_device* device, void* output, const void* input,
                           ma_uint32 frame_count);
  void Render(float* output, uint32_t frame_count);

  ma_device device_{};
  bool device_ready_ = false;

  std::atomic<uint64_t> frames_rendered_{0};
  std::atomic<bool> tone_enabled_{false};
  std::atomic<float> tone_frequency_hz_{kDefaultToneFrequencyHz};
  double tone_phase_ = 0.0;

  Metronome metronome_;
  Tuner tuner_;
  Decoder decoder_;
  Mixer mixer_;
};

}  // namespace kitbag

#endif  // KITBAG_ENGINE_H
