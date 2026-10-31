#include "metronome/click_voices.h"

#include <cmath>

namespace kitbag {

namespace {

constexpr double kTau = 6.283185307179586;
// A decaying voice is retired once it falls below audibility.
constexpr double kVoiceSilenceAmplitude = 1e-4;

}  // namespace

ClickVoices::Voice* ClickVoices::FreeOrQuietest() {
  for (Voice& voice : voices_) {
    if (!voice.active) return &voice;
  }
  Voice* quietest = &voices_[0];
  for (Voice& voice : voices_) {
    if (voice.amplitude < quietest->amplitude) quietest = &voice;
  }
  return quietest;
}

void ClickVoices::Trigger(
    double frequency_hz,
    double amplitude,
    double decay_per_second,
    uint32_t sample_rate
) {
  Voice* slot = FreeOrQuietest();
  slot->active = true;
  slot->phase = 0.0;
  slot->phase_step = kTau * frequency_hz / sample_rate;
  slot->amplitude = amplitude;
  slot->decay_per_sample =
      std::exp(-decay_per_second / static_cast<double>(sample_rate));
}

float ClickVoices::Render() {
  double sample = 0.0;
  for (Voice& voice : voices_) {
    if (!voice.active) continue;
    sample += voice.amplitude * std::sin(voice.phase);
    voice.phase += voice.phase_step;
    voice.amplitude *= voice.decay_per_sample;
    if (voice.amplitude < kVoiceSilenceAmplitude) {
      voice.active = false;
    }
  }
  return static_cast<float>(sample);
}

}  // namespace kitbag
