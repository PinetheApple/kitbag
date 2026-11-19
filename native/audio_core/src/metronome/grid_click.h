#ifndef KITBAG_METRONOME_GRID_CLICK_H
#define KITBAG_METRONOME_GRID_CLICK_H

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

#include "kitbag_metronome_grid_api.h"
#include "metronome/metronome_command.h"
#include "metronome/metronome_types.h"

namespace kitbag {

enum class GridBeatLevel : uint8_t { kSilent, kNormal, kGroup, kBar };
enum class GridClickSetting : int32_t { kGrouping, kRate };

// The beats one click spans: two when x1/2 silences the beat after it.
struct GridSpan {
  size_t start = 0;
  size_t length = 1;
};

// RT-owned bar grouping and click rate for grid mode. The grouping crosses the
// command ring packed into one word, so a block never sees half of it.
class GridClick {
 public:
  static constexpr int kMaxGroups = KB_MAX_GRID_GROUPS;
  static constexpr int kGroupBits = 8;

  static uint64_t Pack(std::span<const int32_t> sizes);
  // Both return true when the ticks per span may have changed.
  bool Apply(const MetronomeCommand& command);
  bool Adopt(const BeatGrid& grid);
  int TicksPerSpan(int subdivision) const;
  bool IsHalfBeat(int tick, int subdivision) const {
    return rate_ == KB_GRID_RATE_DOUBLE && tick == subdivision;
  }
  GridBeatLevel Level(const BeatGrid& grid, size_t beat) const;
  GridSpan SpanAt(const BeatGrid& grid, size_t beat) const;

 private:
  void SetGrouping(uint64_t packed, int32_t count);
  bool SetRate(kb_grid_rate rate);
  bool Grouped(const GridBar& bar) const;
  int32_t GroupStart(const GridBar& bar) const;
  bool OffBeat(const BeatGrid& grid, size_t beat) const;

  int32_t sizes_[kMaxGroups] = {};
  int32_t count_ = 0;
  int32_t sum_ = 0;
  kb_grid_rate rate_ = KB_GRID_RATE_SINGLE;
  uint32_t epoch_ = 0;
};

double SpanTickSeconds(
    const std::vector<double>& times,
    GridSpan span,
    int tick,
    int ticks
);
int FirstSpanTick(
    const std::vector<double>& times,
    GridSpan span,
    int ticks,
    double song_seconds
);

}  // namespace kitbag

#endif  // KITBAG_METRONOME_GRID_CLICK_H
