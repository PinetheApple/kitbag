#ifndef KITBAG_TOOLS_MEDIA_PULSE_STEM_H
#define KITBAG_TOOLS_MEDIA_PULSE_STEM_H

#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

#include "wav_fixture.h"

namespace media_test {

constexpr double kPulseSeconds = 0.06;
constexpr double kPulseHz = 880.0;
constexpr double kPulseGain = 0.5;
constexpr double kTwoPi = 6.283185307179586;

// A Hann-shaped tone centred on each beat, left only: a vocoder keeps no ramp,
// and right stays silent, so right of a mix with the click is the click alone.
inline bool WritePulseStemWav(
    const std::string& path,
    const std::vector<double>& beat_frames,
    int64_t frames,
    uint32_t rate
) {
  constexpr uint32_t kChannels = 2;
  std::vector<float> pcm(static_cast<size_t>(frames) * kChannels, 0.0f);
  const auto half = static_cast<int64_t>(kPulseSeconds * rate / 2.0);
  for (double beat : beat_frames) {
    const auto centre = static_cast<int64_t>(std::llround(beat));
    for (int64_t k = centre - half; k < centre + half; ++k) {
      if (k < 0 || k >= frames) continue;
      const double x = static_cast<double>(k - centre + half) / (2.0 * half);
      const double hann = 0.5 - 0.5 * std::cos(kTwoPi * x);
      const double phase = kTwoPi * kPulseHz * static_cast<double>(k) / rate;
      pcm[static_cast<size_t>(k) * kChannels] =
          static_cast<float>(kPulseGain * hann * std::sin(phase));
    }
  }
  return WriteFloatWav(path, pcm, kChannels, rate);
}

}  // namespace media_test

#endif  // KITBAG_TOOLS_MEDIA_PULSE_STEM_H
