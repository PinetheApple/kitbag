#ifndef KITBAG_METRONOME_GRID_STATE_H
#define KITBAG_METRONOME_GRID_STATE_H

#include <cstddef>
#include <cstdint>
#include <limits>
#include <optional>

#include "metronome/metronome_types.h"

namespace kitbag {

struct GridMapping {
  static constexpr double kRealTime = 1.0;

  uint32_t click_epoch = 0;
  double song_sec = 0.0;
  uint64_t frame = 0;
  double rate = kRealTime;
};

// RT-owned grid cursor. Why identity is a generation and zero forces a re-seed:
// SPEC.md §4.2.1.
struct GridState {
  static constexpr int64_t kReseedFollow = -1;

  uint64_t observed_generation = 0;
  uint32_t observed_click_epoch = 0;
  size_t cursor = 0;
  int64_t beat_index = -1;
  // 1-based next tick in the beat; the tick count means none left.
  int next_sub = 1;
  // Set when the rate or subdivision changes the ticks per span: next_sub is
  // re-derived from the song position so a passed tick never sounds late.
  bool resync_sub = false;
  double pending_shift_sec = 0.0;
  GridOnset last_onset;
  // Any other song frame, a seek or a loop wrap, reseeds the cursor.
  int64_t follow_last_frame = kReseedFollow;
  double follow_seconds = 0.0;
  // Grid beats after this song second wait: the loop's wrap owns that moment.
  double fire_limit = std::numeric_limits<double>::infinity();
  GridMapping mapping;
  std::optional<GridMapping> pending_grid_anchor;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_GRID_STATE_H
