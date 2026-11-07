#ifndef KITBAG_TOOLS_METRONOME_SONG_BARS_H
#define KITBAG_TOOLS_METRONOME_SONG_BARS_H

#include <cstdint>

#include "downbeats.h"
#include "metronome/grid_bars.h"
#include "metronome/metronome_types.h"

namespace metronome_test {

inline void SetSongBars(
    kitbag::BeatGrid* grid,
    int32_t first_downbeat,
    int32_t beats_per_bar
) {
  const size_t count = grid->beat_times_sec.size();
  grid->bars = kitbag::GridBars(
      kitbag_test::EveryNthBeat(first_downbeat, beats_per_bar, count),
      count
  );
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_SONG_BARS_H
