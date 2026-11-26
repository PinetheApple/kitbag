#include <algorithm>
#include <cmath>
#include <optional>
#include <utility>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kMaxNudgeTicks;
using metronome_detail::OnsetFloorSec;

GridMapping Metronome::MappingFor(const BeatGrid& grid) const {
  if (grid_state_.mapping.click_epoch == grid.click_epoch) {
    return grid_state_.mapping;
  }
  return {grid.click_epoch, 0.0, grid.anchor_frame, GridMapping::kRealTime};
}

void Metronome::ApplyPendingGridAnchor(
    const GridView& view,
    uint64_t now,
    uint32_t sample_rate
) {
  const std::optional<GridMapping> next =
      std::exchange(grid_state_.pending_grid_anchor, std::nullopt);
  if (!next || view.grid == nullptr || follow_mixer_ ||
      view.grid->click_epoch != next->click_epoch) {
    return;
  }
  const BeatGrid& grid = *view.grid;
  const double heard = GridSeconds(grid, now, sample_rate);
  grid_state_.mapping = *next;
  const double song_seconds = GridSeconds(grid, now, sample_rate);
  if (!running_) {
    StartOnGrid(view, song_seconds);
    return;
  }
  const double shift_sec = song_seconds - heard;
  if (GridShiftReplays(grid, shift_sec)) {
    grid_state_.last_onset = {};
  } else if (KeepsGridTimeline(grid, shift_sec)) {
    return;
  }
  SeekGridCursor(
      grid,
      std::max(song_seconds, OnsetFloorSec(grid, grid_state_.last_onset))
  );
}

void Metronome::StartOnGrid(const GridView& view, double song_seconds) {
  has_pending_start_ = false;
  ClearPendingAnchors();
  counting_in_ = false;
  count_in_armed_ = false;
  count_in_at_.Clear();
  running_ = true;
  running_flag_.store(true, std::memory_order_relaxed);
  last_tick_ = kNoFiredTick;
  beat_position_ = -LatencyBeats();
  grid_state_.last_onset = {};
  SeekGridCursor(*view.grid, song_seconds);
  grid_state_.observed_generation = view.generation;
}

bool Metronome::KeepsGridTimeline(
    const BeatGrid& grid,
    double shift_sec
) const {
  const auto& times = grid.beat_times_sec;
  if (times.size() < 2) return false;
  const size_t next = Clamp<size_t>(grid_state_.cursor, 1, times.size() - 1);
  const GridSpan span = grid_click_.SpanAt(grid, next - 1);
  const size_t last = std::min(span.start + span.length, times.size() - 1);
  const double tick_sec = (times[last] - times[span.start]) /
                          grid_click_.TicksPerSpan(subdivision_);
  return std::fabs(shift_sec) < kMaxNudgeTicks * tick_sec;
}

}  // namespace kitbag
