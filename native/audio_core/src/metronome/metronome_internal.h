#ifndef KITBAG_METRONOME_METRONOME_INTERNAL_H
#define KITBAG_METRONOME_METRONOME_INTERNAL_H

// Shared by metronome.cpp, metronome_render.cpp and metronome_grid.cpp. Not
// part of any public surface; kitbag_api.h is the contract external callers read.

#include <cmath>
#include <cstddef>

namespace kitbag {
namespace metronome_detail {

// Guards against a boundary landing infinitesimally below an integer.
constexpr double kGridEpsilon = 1e-9;

constexpr double kAccentAmplitude = 0.9;
constexpr double kBeatAmplitude = 0.6;
constexpr double kSubdivisionAmplitude = 0.3;
// About 2.5 dB under an accented beat: audibly apart from it, still far above
// a plain off-beat.
constexpr double kAccentedSubdivisionGain = 0.75;

constexpr double kSecondsPerMinute = 60.0;
constexpr double kMsPerMinute = 60000.0;
constexpr double kMsPerSecond = 1000.0;

// Returns by value: std::clamp returns const T&, which dangles when a caller
// binds the result of a temporary argument.
template <typename T>
T Clamp(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}

inline double BarFraction(double position, int beats_per_bar) {
  const auto bar_beats = static_cast<double>(beats_per_bar);
  double in_bar = std::fmod(position, bar_beats);
  if (in_bar < 0.0) in_bar += bar_beats;
  return in_bar / bar_beats;
}

template <std::size_t N>
bool IsOneOf(const int (&choices)[N], int value) {
  for (const int choice : choices) {
    if (choice == value) return true;
  }
  return false;
}

}  // namespace metronome_detail
}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_INTERNAL_H
