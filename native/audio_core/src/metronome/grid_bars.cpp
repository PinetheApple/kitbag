#include "metronome/grid_bars.h"

namespace kitbag {

namespace {

int32_t LastBarLength(std::span<const int32_t> downbeats, size_t beat_count) {
  const size_t last = downbeats.size() - 1;
  if (last == 0) return static_cast<int32_t>(beat_count) - downbeats[0];
  return downbeats[last] - downbeats[last - 1];
}

void FillPickup(std::vector<GridBar>* bars, int32_t first, int32_t length) {
  for (int32_t i = 0; i < first; ++i) {
    const int32_t before = first - i;
    (*bars)[static_cast<size_t>(i)] = {
        GridBar::kNoBar,
        (length - before % length) % length,
        length
    };
  }
}

}  // namespace

bool ValidDownbeats(std::span<const int32_t> downbeats, int32_t beat_count) {
  int32_t previous = -1;
  for (const int32_t index : downbeats) {
    if (index <= previous || index >= beat_count) return false;
    previous = index;
  }
  return true;
}

std::vector<GridBar>
GridBars(std::span<const int32_t> downbeats, size_t beat_count) {
  std::vector<GridBar> bars(beat_count);
  if (downbeats.empty()) return bars;
  const int32_t tail = LastBarLength(downbeats, beat_count);
  const size_t last = downbeats.size() - 1;
  FillPickup(
      &bars,
      downbeats[0],
      last == 0 ? tail : downbeats[1] - downbeats[0]
  );
  for (size_t k = 0; k < downbeats.size(); ++k) {
    const int32_t start = downbeats[k];
    const int32_t length = k < last ? downbeats[k + 1] - start : tail;
    const auto end =
        k < last ? static_cast<size_t>(downbeats[k + 1]) : beat_count;
    for (size_t i = static_cast<size_t>(start); i < end; ++i) {
      const auto offset = static_cast<int32_t>(i) - start;
      bars[i] = {
          static_cast<int32_t>(k) + offset / length,
          offset % length,
          length
      };
    }
  }
  return bars;
}

}  // namespace kitbag
