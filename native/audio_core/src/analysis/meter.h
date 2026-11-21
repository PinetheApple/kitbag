#ifndef KITBAG_ANALYSIS_METER_H
#define KITBAG_ANALYSIS_METER_H

#include <cstddef>
#include <vector>

namespace kitbag {

constexpr int kTripleBeatsPerBar = 3;
constexpr int kCommonBeatsPerBar = 4;

int DetectBeatsPerBar(const std::vector<double>& beat_sd);

inline int PositionAfter(size_t boundary, int beats_per_bar) {
  return static_cast<int>((boundary + 1) % static_cast<size_t>(beats_per_bar));
}

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_METER_H
