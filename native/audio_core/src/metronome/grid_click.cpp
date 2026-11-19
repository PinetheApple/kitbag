#include "metronome/grid_click.h"

namespace kitbag {

namespace {

constexpr uint64_t kGroupMask = (uint64_t{1} << GridClick::kGroupBits) - 1;
static_assert(GridClick::kMaxGroups * GridClick::kGroupBits <= 64);

}  // namespace

uint64_t GridClick::Pack(std::span<const int32_t> sizes) {
  uint64_t packed = 0;
  for (size_t i = 0; i < sizes.size(); ++i) {
    packed |= (static_cast<uint64_t>(sizes[i]) & kGroupMask)
              << (i * kGroupBits);
  }
  return packed;
}

void GridClick::SetGrouping(uint64_t packed, int32_t count) {
  count_ = count;
  sum_ = 0;
  for (int32_t i = 0; i < count; ++i) {
    sizes_[i] = static_cast<int32_t>((packed >> (i * kGroupBits)) & kGroupMask);
    sum_ += sizes_[i];
  }
}

GridBeatLevel
GridClick::Level(const GridBar& bar, int64_t beat_index, bool has_bars) const {
  if (OffBeat(bar, beat_index, has_bars)) return GridBeatLevel::kSilent;
  if (bar.bar == GridBar::kNoBar) return GridBeatLevel::kNormal;
  if (bar.position == 0) return GridBeatLevel::kBar;
  return StartsGroup(bar) ? GridBeatLevel::kGroup : GridBeatLevel::kNormal;
}

bool GridClick::OffBeat(
    const GridBar& bar,
    int64_t beat_index,
    bool has_bars
) const {
  if (rate_ != KB_GRID_RATE_HALF) return false;
  return (has_bars ? bar.position : beat_index) % 2 != 0;
}

bool GridClick::StartsGroup(const GridBar& bar) const {
  if (count_ == 0 || bar.length != sum_) return false;
  int32_t start = 0;
  for (int32_t i = 0; i < count_ && start <= bar.position; ++i) {
    if (start == bar.position) return true;
    start += sizes_[i];
  }
  return false;
}

}  // namespace kitbag
