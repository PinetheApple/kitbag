#ifndef KITBAG_METRONOME_GRID_CLICK_H
#define KITBAG_METRONOME_GRID_CLICK_H

#include <cstdint>
#include <span>

#include "kitbag_metronome_grid_api.h"
#include "metronome/metronome_types.h"

namespace kitbag {

enum class GridBeatLevel : uint8_t { kSilent, kNormal, kGroup, kBar };

// RT-owned bar grouping and click rate for grid mode. The grouping crosses the
// command ring packed into one word, so a block never sees half of it.
class GridClick {
 public:
  static constexpr int kMaxGroups = KB_MAX_GRID_GROUPS;
  static constexpr int kGroupBits = 8;

  static uint64_t Pack(std::span<const int32_t> sizes);
  void SetGrouping(uint64_t packed, int32_t count);
  void SetRate(int32_t rate) {
    rate_ = rate;
  }
  int TicksPerBeat(int subdivision) const {
    return rate_ == KB_GRID_RATE_DOUBLE ? 2 * subdivision : subdivision;
  }
  bool IsHalfBeat(int tick, int subdivision) const {
    return rate_ == KB_GRID_RATE_DOUBLE && tick == subdivision;
  }
  GridBeatLevel
  Level(const GridBar& bar, int64_t beat_index, bool has_bars) const;

 private:
  bool OffBeat(const GridBar& bar, int64_t beat_index, bool has_bars) const;
  bool StartsGroup(const GridBar& bar) const;

  int32_t sizes_[kMaxGroups] = {};
  int32_t count_ = 0;
  int32_t sum_ = 0;
  int32_t rate_ = KB_GRID_RATE_SINGLE;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_GRID_CLICK_H
