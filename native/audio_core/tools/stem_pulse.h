#ifndef KITBAG_TOOLS_STEM_PULSE_H
#define KITBAG_TOOLS_STEM_PULSE_H

#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <numbers>
#include <string>
#include <vector>

#include "wav_fixture.h"

namespace media_test {

// A Hann-shaped tone centred on each beat, left only: a vocoder keeps no ramp,
// and right stays silent, so right of a mix with the click is the click alone.
inline bool WritePulseStemWav(
    const std::string& path,
    const std::vector<double>& beat_frames,
    int64_t frames,
    uint32_t sample_rate
) {
  constexpr uint32_t kChannels = 2;
  constexpr double kPulseSeconds = 0.06;
  constexpr double kPulseHz = 880.0;
  constexpr double kPulseGain = 0.5;
  constexpr double kTwoPi = 2.0 * std::numbers::pi;
  std::vector<float> pcm(static_cast<size_t>(frames) * kChannels, 0.0f);
  const auto half = static_cast<int64_t>(kPulseSeconds * sample_rate / 2.0);
  for (double beat : beat_frames) {
    const auto centre = static_cast<int64_t>(std::llround(beat));
    for (int64_t k = centre - half; k < centre + half; ++k) {
      if (k < 0 || k >= frames) continue;
      const double x = static_cast<double>(k - centre + half) / (2.0 * half);
      const double hann = 0.5 - 0.5 * std::cos(kTwoPi * x);
      const double phase =
          kTwoPi * kPulseHz * static_cast<double>(k) / sample_rate;
      pcm[static_cast<size_t>(k) * kChannels] =
          static_cast<float>(kPulseGain * hann * std::sin(phase));
    }
  }
  return WriteFloatWav(path, pcm, kChannels, sample_rate);
}

inline kb_engine* OpenFollowingEngine(
    const std::string& stem,
    const std::vector<double>& beat_seconds
) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  if (kb_mixer_load_track(engine, 0, stem.c_str()) != KB_OK ||
      kb_metronome_set_grid(
          engine,
          beat_seconds.data(),
          static_cast<int32_t>(beat_seconds.size()),
          0
      ) != KB_OK) {
    kb_engine_destroy(engine);
    return nullptr;
  }
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

}  // namespace media_test

#endif  // KITBAG_TOOLS_STEM_PULSE_H
