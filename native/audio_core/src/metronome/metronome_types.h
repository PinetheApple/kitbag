#ifndef KITBAG_METRONOME_METRONOME_TYPES_H
#define KITBAG_METRONOME_METRONOME_TYPES_H

#include <cstdint>
#include <limits>
#include <vector>

namespace kitbag {

inline constexpr double kMinBpm = 20.0;
inline constexpr double kMaxBpm = 400.0;

enum class Accent : uint8_t { kMuted = 0, kNormal = 1, kAccented = 2 };

struct GridBar {
  static constexpr int32_t kNoBar = -1;
  // kNoBar before the first downbeat, and on every beat of a grid without any.
  int32_t bar = kNoBar;
  int32_t position = 0;
  int32_t length = 1;
};

struct BeatGrid {
  std::vector<double> beat_times_sec;
  // Song second t falls on engine frame anchor_frame + t * sample_rate.
  uint64_t anchor_frame = 0;
  // One per beat; Metronome::SetGrid fills a mismatched set with no bars.
  std::vector<GridBar> bars;
};

struct GridOnset {
  double song_sec = -std::numeric_limits<double>::infinity();
  uint64_t anchor_frame = 0;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_TYPES_H
