// Grid mode: following a song's measured beat times instead of a single BPM.
// Called from the audio callback; the concurrency argument is SPEC.md §4.2.1.
#include <algorithm>
#include <cmath>
#include <limits>
#include <vector>

#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kGridEpsilon;
using metronome_detail::kMsPerSecond;
using metronome_detail::kSecondsPerMinute;
using metronome_detail::OnsetFloorSec;
using metronome_detail::PhaseBelowOne;

namespace {

bool BeatDue(
    const std::vector<double>& times,
    size_t cursor,
    double song_seconds,
    double fire_limit
) {
  return cursor < times.size() &&
         song_seconds + kGridEpsilon >= times[cursor] &&
         times[cursor] <= fire_limit;
}

int FirstUnsoundedSub(
    const std::vector<double>& times,
    size_t cursor,
    int subdivision,
    double song_seconds
) {
  if (cursor == 0 || cursor >= times.size()) return 1;
  const double previous = times[cursor - 1];
  const double interval = times[cursor] - previous;
  const double ticks = std::ceil(
      (song_seconds - kGridEpsilon - previous) / interval * subdivision
  );
  return Clamp(static_cast<int>(ticks), 1, subdivision);
}

}  // namespace

double Metronome::GridSeconds(
    const BeatGrid& grid,
    uint64_t frame,
    uint32_t sample_rate
) const {
  return (static_cast<double>(frame) - static_cast<double>(grid.anchor_frame)) /
             sample_rate +
         latency_offset_ms_ / kMsPerSecond;
}

// Zero is never a live generation, so the next block re-seeds the cursor.
void Metronome::ReacquireGrid() {
  observed_generation_ = 0;
}

void Metronome::SeekGridCursor(const BeatGrid& grid, double song_seconds) {
  const auto& times = grid.beat_times_sec;
  // Same epsilon as RenderGridBeat's firing rule, so a beat the render loop
  // considers already crossed is never seeked back onto.
  const auto first_at_or_after =
      std::lower_bound(times.begin(), times.end(), song_seconds - kGridEpsilon);
  grid_cursor_ = static_cast<size_t>(first_at_or_after - times.begin());
  grid_beat_index_ = static_cast<int64_t>(grid_cursor_) - 1;
  grid_next_sub_ =
      FirstUnsoundedSub(times, grid_cursor_, subdivision_, song_seconds);
  SyncGridBar();
}

bool Metronome::GridShiftReplays(const BeatGrid& grid, double shift_sec) const {
  const auto& times = grid.beat_times_sec;
  if (shift_sec >= 0.0 || times.size() < 2) return false;
  const size_t next = Clamp<size_t>(grid_cursor_, 1, times.size() - 1);
  const double replay_threshold_sec = times[next] - times[next - 1];
  return -shift_sec + kGridEpsilon >= replay_threshold_sec;
}

// Derived, never incremented: a re-anchor re-crosses downbeats, and counting
// them would make bar-mute phase depend on re-anchor count (SPEC.md §4.2.1).
// Grid mode ignores the denominator (D1): bars count tracker beats, so 7/8 bars
// every 7 grid beats and PublishGridMirrors' rate is not quarter-referenced.
void Metronome::SyncGridBar() {
  current_bar_ = grid_beat_index_ < 0 ? -1 : grid_beat_index_ / beats_per_bar_;
}

void Metronome::RenderGridBeat(
    const BeatGrid& grid,
    double song_seconds,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  if (!BeatDue(times, grid_cursor_, song_seconds, grid_fire_limit_)) {
    RenderGridSubdivision(grid, song_seconds, sample_rate);
    return;
  }

  // Advance past beats the grid packs closer than one sample so a dense grid
  // cannot fire twice for one frame — but count every one, or the bar drifts.
  while (BeatDue(times, grid_cursor_, song_seconds, grid_fire_limit_)) {
    ++grid_cursor_;
    ++grid_beat_index_;
  }
  SyncGridBar();
  grid_next_sub_ = 1;
  last_onset_ = {times[grid_cursor_ - 1], grid.anchor_frame};
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
  if (song_seconds + kGridEpsilon >= tick && tick <= grid_fire_limit_) {
    const int slot = grid_next_sub_++;
    last_onset_ = {tick, grid.anchor_frame};
    // The tick sits in [grid_cursor_-1, grid_cursor_], so its owning beat is
    // grid_beat_index_ (== grid_cursor_-1, and >= 0 given the guard above).
    OnSubdivisionTick(grid_beat_index_, slot, sample_rate);
  }
}

// The sweep and the BPM readout must come from the same grid the click does,
// or the UI drifts against what is audible (§4.5).
void Metronome::PublishGridMirrors(const BeatGrid& grid, double song_seconds) {
  const auto& times = grid.beat_times_sec;
  // Outside any interval — before the first beat, or past the last, which every
  // song reaches — hold the last sweep and tempo rather than snapping to zero.
  if (grid_cursor_ == 0 || grid_cursor_ >= times.size()) return;
  const double previous = times[grid_cursor_ - 1];
  const double interval = times[grid_cursor_] - previous;
  if (interval <= 0.0) return;

  // Same epsilon as BeatDue: the fired beat reads >= 0, the next one < 1. A
  // backward wait puts the position behind the fired beat; hold there.
  const double beat_fraction =
      std::max(0.0, (song_seconds + kGridEpsilon - previous) / interval);
  const double beat_in_bar =
      static_cast<double>(grid_beat_index_ % beats_per_bar_);
  bar_phase_.store(
      PhaseBelowOne((beat_in_bar + beat_fraction) / beats_per_bar_),
      std::memory_order_relaxed
  );
  // Clamped to the same range SetTempo enforces: a beat tracker emits outlier
  // intervals by nature, and this atomic is the tempo the UI reads out.
  current_bpm_.store(
      Clamp(kSecondsPerMinute / interval, kMinBpm, kMaxBpm),
      std::memory_order_relaxed
  );
}

namespace {

double FireLimitSec(const LoopLayout& layout, uint32_t sample_rate) {
  return layout.looping ? static_cast<double>(layout.end - 1) / sample_rate
                        : std::numeric_limits<double>::infinity();
}

// A re-prime rewinds the song under beats that already sounded, and only those:
// an onset ahead of the frame last heard belongs to a pass since wrapped.
double ContinuationSeekSec(
    const BeatGrid& grid,
    const GridOnset& last_onset,
    double head_sec,
    double next_heard_sec
) {
  if (last_onset.song_sec > next_heard_sec) return head_sec;
  return std::max(head_sec, OnsetFloorSec(grid, last_onset));
}

}  // namespace

void Metronome::RenderGridSample(
    const BeatGrid& grid,
    const SongClock* song,
    uint64_t now,
    uint32_t frame,
    uint32_t sample_rate
) {
  if (!follow_mixer_) {
    grid_fire_limit_ = std::numeric_limits<double>::infinity();
    RenderGridBeat(grid, GridSeconds(grid, now, sample_rate), sample_rate);
    return;
  }
  if (song == nullptr || !song->playing || frame >= song->frames) return;
  const SongPoint point = song->PointAt(frame);
  const auto whole_frame = static_cast<double>(point.frame);
  follow_seconds_ = (whole_frame + point.fraction) / sample_rate;
  grid_fire_limit_ = FireLimitSec(*point.layout, sample_rate);
  // Below 1.0x a song frame repeats, which is no jump. A new pass lands inside
  // a frame, so seek to its start or a beat right on the loop start is skipped.
  const int64_t step = point.frame - follow_last_frame_;
  const bool opens_on_jump = song->opens_on_jump && frame == 0;
  if (follow_last_frame_ == kReseedFollow || opens_on_jump || step < 0 ||
      step > 1) {
    const double head_sec = whole_frame / sample_rate;
    const double next_heard_sec =
        static_cast<double>(follow_last_frame_ + 1) / sample_rate;
    SeekGridCursor(
        grid,
        opens_on_jump && song->continues_run
            ? ContinuationSeekSec(grid, last_onset_, head_sec, next_heard_sec)
            : head_sec
    );
  }
  follow_last_frame_ = point.frame;
  RenderGridBeat(grid, follow_seconds_, sample_rate);
}

}  // namespace kitbag
