#ifndef KITBAG_METRONOME_GRID_STATE_H
#define KITBAG_METRONOME_GRID_STATE_H

#include <cstddef>
#include <cstdint>
#include <limits>

#include "metronome/metronome_types.h"

namespace kitbag {

// RT-owned grid cursor. Why identity is a generation and zero forces a re-seed:
// SPEC.md §4.2.1.
struct GridState {
  static constexpr int64_t kReseedFollow = -1;

  uint64_t observed_generation = 0;
  size_t cursor = 0;
  int64_t beat_index = -1;
  // 1-based next subdivision tick in the beat; subdivision_ means none left.
  int next_sub = 1;
  double pending_shift_sec = 0.0;
  GridOnset last_onset;
  // Any other song frame, a seek or a loop wrap, reseeds the cursor.
  int64_t follow_last_frame = kReseedFollow;
  double follow_seconds = 0.0;
  // Grid beats after this song second wait: the loop's wrap owns that moment.
  double fire_limit = std::numeric_limits<double>::infinity();
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_GRID_STATE_H
