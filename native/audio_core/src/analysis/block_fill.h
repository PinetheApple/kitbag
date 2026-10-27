#ifndef KITBAG_ANALYSIS_BLOCK_FILL_H
#define KITBAG_ANALYSIS_BLOCK_FILL_H

#include <algorithm>
#include <cstddef>
#include <vector>

namespace kitbag {

/// Appends `count` samples to `block` from `filled` on, calling `on_full` each
/// time it fills; `on_full` returns how many samples stay in the block.
template <typename OnFull>
size_t FillBlock(
    const float* in,
    size_t count,
    std::vector<float>& block,
    size_t filled,
    OnFull on_full
) {
  while (count > 0) {
    const size_t take = std::min(count, block.size() - filled);
    std::copy(in, in + take, block.begin() + filled);
    filled += take;
    in += take;
    count -= take;
    if (filled == block.size()) filled = on_full();
  }
  return filled;
}

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BLOCK_FILL_H
