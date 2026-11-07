#ifndef KITBAG_TOOLS_DOWNBEATS_H
#define KITBAG_TOOLS_DOWNBEATS_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace kitbag_test {

inline std::vector<int32_t>
EveryNthBeat(int32_t first, int32_t beats_per_bar, size_t beat_count) {
  std::vector<int32_t> downbeats;
  for (int32_t b = first; static_cast<size_t>(b) < beat_count;
       b += beats_per_bar) {
    downbeats.push_back(b);
  }
  return downbeats;
}

}  // namespace kitbag_test

#endif  // KITBAG_TOOLS_DOWNBEATS_H
