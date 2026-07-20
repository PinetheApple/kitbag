// Grid mode: following a song's measured beat times instead of a single BPM.
// Called from the audio callback; the concurrency argument is SPEC.md §4.2.1.
#include <algorithm>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;
using metronome_detail::kMsPerSecond;
using metronome_detail::kSecondsPerMinute;

double Metronome::GridSeconds(
    const BeatGrid& grid,
    uint64_t frame,
    uint32_t sample_rate
) const {
  return (static_cast<double>(frame) - static_cast<double>(grid.anchor_frame)) /
             sample_rate +
         latency_offset_ms_ / kMsPerSecond;
}

void Metronome::SeekGridCursor(const BeatGrid& grid, double song_seconds) {
  const auto& times = grid.beat_times_sec;
  // Same epsilon as RenderGridBeat's firing rule, so a beat the render loop
  // considers already crossed is never seeked back onto.
  const auto first_at_or_after =
      std::lower_bound(times.begin(), times.end(), song_seconds - kGridEpsilon);
  grid_cursor_ = static_cast<size_t>(first_at_or_after - times.begin());
  grid_beat_index_ = static_cast<int64_t>(grid_cursor_) - 1;
  grid_next_sub_ = 1;
  SyncGridBar();
}

// Derived, never incremented: a re-anchor re-crosses downbeats, and counting
// them would make bar-mute phase depend on re-anchor count (SPEC.md §4.2.1).
void Metronome::SyncGridBar() {
  current_bar_ = grid_beat_index_ < 0 ? -1 : grid_beat_index_ / beats_per_bar_;
}

void Metronome::RenderGridBeat(
    const BeatGrid& grid,
    uint64_t frame,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  const double song_seconds = GridSeconds(grid, frame, sample_rate);
  if (grid_cursor_ >= times.size() ||
      song_seconds + kGridEpsilon < times[grid_cursor_]) {
    RenderGridSubdivision(grid, song_seconds, sample_rate);
    return;
  }

  // Advance past beats the grid packs closer than one sample so a dense grid
  // cannot fire twice for one frame — but count every one, or the bar drifts.
  while (grid_cursor_ < times.size() &&
         song_seconds + kGridEpsilon >= times[grid_cursor_]) {
    ++grid_cursor_;
    ++grid_beat_index_;
  }
  SyncGridBar();
  grid_next_sub_ = 1;
  // Re-anchoring the constant-tempo phase onto this beat is what makes
  // ClearGrid's "keeps its phase" true (SPEC.md §4.2.1).
  beat_position_ = static_cast<double>(grid_beat_index_) - LatencyBeats();
  OnBeatBoundary(
      static_cast<int>(grid_beat_index_ % beats_per_bar_),
      sample_rate
  );
}

// Subdivisions divide the measured interval, so they drift with the song the
// same way the beats do. Only inside a known interval — outside there is none.
void Metronome::RenderGridSubdivision(
    const BeatGrid& grid,
    double song_seconds,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  if (subdivision_ <= 1 || grid_cursor_ == 0 || grid_cursor_ >= times.size() ||
      grid_next_sub_ >= subdivision_) {
    return;
  }
  const double previous = times[grid_cursor_ - 1];
  const double interval = times[grid_cursor_] - previous;
  const double tick = previous + interval * grid_next_sub_ / subdivision_;
  if (song_seconds + kGridEpsilon >= tick) {
    ++grid_next_sub_;
    OnSubdivisionTick(sample_rate);
  }
}

// The sweep and the BPM readout must come from the same grid the click does,
// or the UI drifts against what is audible (§4.5).
void Metronome::PublishGridMirrors(
    const BeatGrid& grid,
    uint64_t frame,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  // Outside any interval — before the first beat, or past the last, which every
  // song reaches — hold the last sweep and tempo rather than snapping to zero.
  if (grid_cursor_ == 0 || grid_cursor_ >= times.size()) return;
  const double previous = times[grid_cursor_ - 1];
  const double interval = times[grid_cursor_] - previous;
  if (interval <= 0.0) return;

  const double beat_fraction =
      (GridSeconds(grid, frame, sample_rate) - previous) / interval;
  const double beat_in_bar =
      static_cast<double>(grid_beat_index_ % beats_per_bar_);
  bar_phase_.store(
      (beat_in_bar + beat_fraction) / beats_per_bar_,
      std::memory_order_relaxed
  );
  // Clamped to the same range SetTempo enforces: a beat tracker emits outlier
  // intervals by nature, and this atomic is the tempo the UI reads out.
  current_bpm_.store(
      Clamp(kSecondsPerMinute / interval, kMinBpm, kMaxBpm),
      std::memory_order_relaxed
  );
}

}  // namespace kitbag
