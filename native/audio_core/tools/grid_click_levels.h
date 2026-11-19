#ifndef KITBAG_TOOLS_GRID_CLICK_LEVELS_H
#define KITBAG_TOOLS_GRID_CLICK_LEVELS_H

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

#include "metronome/metronome_internal.h"

namespace grid_levels {

using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kAccentedSubdivisionGain;
using kitbag::metronome_detail::kBeatAmplitude;

constexpr char kBar = 'B';
constexpr char kGroup = 'G';
constexpr char kNormal = 'n';
constexpr char kSilent = '-';
constexpr char kMisplaced = 'x';

constexpr double kGroupAmplitude = kAccentAmplitude * kAccentedSubdivisionGain;
constexpr double kBarFloor = (kAccentAmplitude + kGroupAmplitude) / 2.0;
constexpr double kGroupFloor = (kGroupAmplitude + kBeatAmplitude) / 2.0;
constexpr float kLoud = 1e-2f;
// Under half the closest pair of clicks these fixtures place.
constexpr int64_t kSearchFrames = 1200;
constexpr int64_t kPeakFrames = 480;
// A voice is silent on its trigger frame; the grid's own rounding adds one.
constexpr int64_t kOnsetSlack = 4;

inline int64_t FirstLoud(const std::vector<float>& channel, int64_t frame) {
  const auto size = static_cast<int64_t>(channel.size());
  for (int64_t k = std::max<int64_t>(frame - kSearchFrames, 0);
       k < std::min(frame + kSearchFrames, size);
       ++k) {
    if (std::fabs(channel[static_cast<size_t>(k)]) > kLoud) return k;
  }
  return -1;
}

inline char LevelAt(const std::vector<float>& channel, int64_t frame) {
  const int64_t first = FirstLoud(channel, frame);
  if (first < 0) return kSilent;
  if (std::llabs(first - frame) > kOnsetSlack) return kMisplaced;
  float peak = 0.0f;
  const auto end = std::min<int64_t>(
      first + kPeakFrames,
      static_cast<int64_t>(channel.size())
  );
  for (int64_t k = first; k < end; ++k) {
    peak = std::max(peak, std::fabs(channel[static_cast<size_t>(k)]));
  }
  if (peak > kBarFloor) return kBar;
  return peak > kGroupFloor ? kGroup : kNormal;
}

inline std::string
Levels(const std::vector<float>& channel, const std::vector<int64_t>& frames) {
  std::string levels;
  for (const int64_t frame : frames) levels += LevelAt(channel, frame);
  return levels;
}

}  // namespace grid_levels

#endif  // KITBAG_TOOLS_GRID_CLICK_LEVELS_H
