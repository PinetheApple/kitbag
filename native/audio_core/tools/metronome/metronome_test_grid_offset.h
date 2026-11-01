#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace metronome_test {

enum class ShiftRule : uint8_t { kDrop, kReseek, kWait };

struct OffsetChange {
  const char* name;
  double interval_sec;
  double from_ms;
  double to_ms;
  int64_t change_frame;
  ShiftRule rule;
  int subdivision;
};

struct OffsetRender {
  std::vector<int64_t> onsets;
  double min_bar_phase;
};

constexpr int kOffsetGridBeats = 60;
constexpr int64_t kNoOffsetChange = -1;

std::vector<int64_t> ExpectedOnsets(const OffsetChange& change, ShiftRule rule);
size_t CrossedTicks(const OffsetChange& change);
OffsetRender RenderOffsetChange(
    const OffsetChange& change,
    int64_t change_frame,
    bool follow
);

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H
