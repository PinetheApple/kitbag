#ifndef KITBAG_METRONOME_GRID_BARS_H
#define KITBAG_METRONOME_GRID_BARS_H

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

#include "metronome/metronome_types.h"

namespace kitbag {

bool ValidDownbeats(std::span<const int32_t> downbeats, int32_t beat_count);

// App thread only: allocates.
std::vector<GridBar>
GridBars(std::span<const int32_t> downbeats, size_t beat_count);

}  // namespace kitbag

#endif  // KITBAG_METRONOME_GRID_BARS_H
