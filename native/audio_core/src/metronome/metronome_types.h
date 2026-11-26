#ifndef KITBAG_METRONOME_METRONOME_TYPES_H
#define KITBAG_METRONOME_METRONOME_TYPES_H

#include <cstdint>
#include <limits>
#include <vector>

namespace kitbag {

inline constexpr double kMinBpm = 20.0;
inline constexpr double kMaxBpm = 400.0;
inline constexpr int64_t kNoFiredTick = std::numeric_limits<int64_t>::min();

enum class Accent : uint8_t { kMuted = 0, kNormal = 1, kAccented = 2 };

enum class ClickRole : uint8_t {
  kBeat,
  kAccent,
  kSubdivision,
  kAccentedSubdivision,
  kPoly,
  kPolyAccent
};

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
  // Metronome::SetGrid stamps it; grid-click settings sent before it are stale.
  uint32_t click_epoch = 0;
};

inline bool HasDownbeats(const BeatGrid& grid) {
  return !grid.bars.empty() && grid.bars.back().bar != GridBar::kNoBar;
}

// Per-block tempo derivatives, recomputed whenever bpm_ changes mid-block.
struct BlockTempo {
  double beats_per_sample = 0.0;
  double latency_beats = 0.0;
  double poly_ticks_per_beat = 1.0;
};

// The block's grid and its identity, from one acquire load (SPEC.md §4.2.1).
struct GridView {
  const BeatGrid* grid = nullptr;
  uint64_t generation = 0;
};

struct GridOnset {
  double song_sec = -std::numeric_limits<double>::infinity();
  uint64_t anchor_frame = 0;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_METRONOME_TYPES_H
