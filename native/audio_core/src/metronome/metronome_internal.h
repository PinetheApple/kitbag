#ifndef KITBAG_METRONOME_METRONOME_INTERNAL_H
#define KITBAG_METRONOME_METRONOME_INTERNAL_H

// Shared by metronome.cpp, metronome_render.cpp and metronome_grid.cpp. Not
// part of any public surface; kitbag_api.h is the contract external callers read.

namespace kitbag {
namespace metronome_detail {

// Guards against a boundary landing infinitesimally below an integer.
constexpr double kGridEpsilon = 1e-9;

constexpr double kSecondsPerMinute = 60.0;
constexpr double kMsPerMinute = 60000.0;
constexpr double kMsPerSecond = 1000.0;

// Returns by value: std::clamp returns const T&, which dangles when a caller
// binds the result of a temporary argument.
template <typename T>
T Clamp(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}

}  // namespace metronome_detail
}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_INTERNAL_H
