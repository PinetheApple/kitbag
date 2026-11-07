#ifndef KITBAG_TOOLS_METRONOME_SONG_BARS_H
#define KITBAG_TOOLS_METRONOME_SONG_BARS_H

#include <cstdint>
#include <vector>

#include "metronome/grid_bars.h"
#include "metronome/metronome_types.h"

namespace metronome_test {

inline std::vector<int32_t>
EveryNthBeat(int32_t first, int32_t beats_per_bar, size_t beat_count) {
  std::vector<int32_t> downbeats;
  for (int32_t b = first; static_cast<size_t>(b) < beat_count;
       b += beats_per_bar) {
    downbeats.push_back(b);
  }
  return downbeats;
}

inline void SetSongBars(
    kitbag::BeatGrid* grid,
    int32_t first_downbeat,
    int32_t beats_per_bar
) {
  const size_t count = grid->beat_times_sec.size();
  grid->bars = kitbag::GridBars(
      EveryNthBeat(first_downbeat, beats_per_bar, count),
      count
  );
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_SONG_BARS_H
