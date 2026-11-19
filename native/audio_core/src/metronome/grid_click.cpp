#include "metronome/grid_click.h"

#include <algorithm>
#include <cmath>

#include "metronome/metronome_internal.h"

namespace kitbag {

namespace {

using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;

constexpr uint64_t kGroupMask = (uint64_t{1} << GridClick::kGroupBits) - 1;
static_assert(GridClick::kMaxGroups * GridClick::kGroupBits <= 64);
constexpr int kHalfRateStep = 2;
constexpr int kDoubleRateFactor = 2;

}  // namespace

uint64_t GridClick::Pack(std::span<const int32_t> sizes) {
  uint64_t packed = 0;
  for (size_t i = 0; i < sizes.size(); ++i) {
    packed |= (static_cast<uint64_t>(sizes[i]) & kGroupMask)
              << (i * kGroupBits);
  }
  return packed;
}

bool GridClick::Apply(const MetronomeCommand& command) {
  if (command.epoch < epoch_) return false;
  epoch_ = command.epoch;
  if (static_cast<GridClickSetting>(command.int_b) == GridClickSetting::kRate) {
    return SetRate(static_cast<kb_grid_rate>(command.int_a));
  }
  SetGrouping(command.word, command.int_a);
  return false;
}

bool GridClick::Adopt(const BeatGrid& grid) {
  if (grid.click_epoch <= epoch_) return false;
  epoch_ = grid.click_epoch;
  count_ = 0;
  sum_ = 0;
  return SetRate(KB_GRID_RATE_SINGLE);
}

bool GridClick::SetRate(kb_grid_rate rate) {
  const bool changed = rate != rate_;
  rate_ = rate;
  return changed;
}

void GridClick::SetGrouping(uint64_t packed, int32_t count) {
  count_ = Clamp(count, 0, kMaxGroups);
  sum_ = 0;
  for (int32_t i = 0; i < count_; ++i) {
    sizes_[i] = static_cast<int32_t>((packed >> (i * kGroupBits)) & kGroupMask);
    sum_ += sizes_[i];
  }
}

int GridClick::TicksPerSpan(int subdivision) const {
  return rate_ == KB_GRID_RATE_DOUBLE ? kDoubleRateFactor * subdivision
                                      : subdivision;
}

bool GridClick::Grouped(const GridBar& bar) const {
  return count_ > 0 && bar.bar != GridBar::kNoBar && bar.length == sum_;
}

int32_t GridClick::GroupStart(const GridBar& bar) const {
  if (!Grouped(bar)) return 0;
  int32_t start = 0;
  for (int32_t i = 0; i < count_ && start + sizes_[i] <= bar.position; ++i) {
    start += sizes_[i];
  }
  return start;
}

bool GridClick::OffBeat(const BeatGrid& grid, size_t beat) const {
  if (rate_ != KB_GRID_RATE_HALF) return false;
  if (!HasDownbeats(grid)) return beat % kHalfRateStep != 0;
  const GridBar& bar = grid.bars[beat];
  return (bar.position - GroupStart(bar)) % kHalfRateStep != 0;
}

GridBeatLevel GridClick::Level(const BeatGrid& grid, size_t beat) const {
  if (OffBeat(grid, beat)) return GridBeatLevel::kSilent;
  const GridBar& bar = grid.bars[beat];
  if (bar.bar == GridBar::kNoBar) return GridBeatLevel::kNormal;
  if (bar.position == 0) return GridBeatLevel::kBar;
  return Grouped(bar) && GroupStart(bar) == bar.position
             ? GridBeatLevel::kGroup
             : GridBeatLevel::kNormal;
}

GridSpan GridClick::SpanAt(const BeatGrid& grid, size_t beat) const {
  if (beat > 0 && OffBeat(grid, beat)) return {beat - 1, kHalfRateStep};
  const bool next_silent =
      beat + 1 < grid.bars.size() && OffBeat(grid, beat + 1);
  return {beat, next_silent ? size_t{kHalfRateStep} : size_t{1}};
}

double SpanTickSeconds(
    const std::vector<double>& times,
    GridSpan span,
    int tick,
    int ticks
) {
  const double beats = static_cast<double>(tick) * span.length / ticks;
  const double whole = std::floor(beats + kGridEpsilon);
  const size_t at = span.start + static_cast<size_t>(whole);
  if (at + 1 >= times.size()) return times[at];
  return times[at] + (beats - whole) * (times[at + 1] - times[at]);
}

int FirstSpanTick(
    const std::vector<double>& times,
    GridSpan span,
    int ticks,
    double song_seconds
) {
  const size_t end = span.start + span.length;
  if (end >= times.size()) return 1;
  const auto next = static_cast<size_t>(
      std::upper_bound(
          times.begin() + span.start,
          times.begin() + end,
          song_seconds - kGridEpsilon
      ) -
      times.begin()
  );
  const size_t at = std::clamp(next, span.start + 1, end) - 1;
  const double into =
      (song_seconds - kGridEpsilon - times[at]) / (times[at + 1] - times[at]);
  const double beats =
      static_cast<double>(at - span.start) + Clamp(into, 0.0, 1.0);
  return Clamp(
      static_cast<int>(std::ceil(beats * ticks / span.length)),
      1,
      ticks
  );
}

}  // namespace kitbag
