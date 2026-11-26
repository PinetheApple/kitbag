// Grid mode: following a song's measured beat times instead of a single BPM.
// Called from the audio callback; the concurrency argument is SPEC.md §4.2.1.
#include <algorithm>
#include <cmath>
#include <limits>
#include <utility>
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
    const GridState& state,
    double song_seconds
) {
  return state.cursor < times.size() &&
         song_seconds + kGridEpsilon >= times[state.cursor] &&
         times[state.cursor] <= state.fire_limit;
}

}  // namespace

double Metronome::GridSeconds(
    const BeatGrid& grid,
    uint64_t frame,
    uint32_t sample_rate
) const {
  const GridMapping mapping = MappingFor(grid);
  const double since_sec =
      (static_cast<double>(frame) - static_cast<double>(mapping.frame)) /
      sample_rate;
  return mapping.song_sec +
         (since_sec + latency_offset_ms_ / kMsPerSecond) * mapping.rate;
}

// Zero is never a live generation, so the next block re-seeds the cursor.
void Metronome::ReacquireGrid() {
  grid_state_.observed_generation = 0;
  grid_state_.observed_click_epoch = 0;
}

// Song bars stop at a clear; constant tempo counts bars from beat_position_.
bool Metronome::ObserveGridChange(const GridView& view, uint32_t sample_rate) {
  grid_state_.observed_generation = view.generation;
  const uint32_t epoch = view.grid == nullptr ? 0 : view.grid->click_epoch;
  const bool same_grid =
      epoch == grid_state_.observed_click_epoch && epoch != 0;
  grid_state_.observed_click_epoch = epoch;
  if (same_grid) {
    RebarGrid(*view.grid);
    return false;
  }
  grid_state_.follow_last_frame = GridState::kReseedFollow;
  if (view.grid != nullptr && grid_click_.Adopt(*view.grid)) {
    grid_state_.resync_sub = true;
  }
  if (view.grid == nullptr && running_) {
    SyncBarFromPosition(BlockTempoFor(sample_rate).beats_per_sample);
  }
  return true;
}

void Metronome::RebarGrid(const BeatGrid& grid) {
  SyncGridBar(grid);
  grid_state_.resync_sub = true;
  if (grid_state_.beat_index < 0) return;
  const auto beat = static_cast<size_t>(grid_state_.beat_index);
  current_beat_.store(grid.bars[beat].position, std::memory_order_relaxed);
}

GridView
Metronome::AcquireGrid(uint64_t block_start_frame, uint32_t sample_rate) {
  // One acquire load per block. Change is detected by generation, never by
  // address: a freed grid's address can be recycled, a generation cannot.
  const auto* node = grid_.Get();
  GridView view;
  if (node != nullptr && !node->value.beat_times_sec.empty()) {
    view.grid = &node->value;
    view.generation = node->generation;
  }
  const bool changed = view.generation != grid_state_.observed_generation &&
                       ObserveGridChange(view, sample_rate);
  const double offset_shift_sec =
      std::exchange(grid_state_.pending_shift_sec, 0.0);
  if (view.grid == nullptr || follow_mixer_) return view;
  const double shift_sec = offset_shift_sec * MappingFor(*view.grid).rate;
  // Only a whole-beat backward shift clears the floor to replay (§4.7); other
  // re-seeds land past the last onset this run heard on this anchor.
  const bool replays = !changed && GridShiftReplays(*view.grid, shift_sec);
  if (replays) grid_state_.last_onset = {};
  if (changed || shift_sec != 0.0) {
    SeekGridCursor(
        *view.grid,
        std::max(
            GridSeconds(*view.grid, block_start_frame, sample_rate),
            OnsetFloorSec(*view.grid, grid_state_.last_onset)
        )
    );
  }
  return view;
}

void Metronome::SeekGridCursor(const BeatGrid& grid, double song_seconds) {
  const auto& times = grid.beat_times_sec;
  // Same epsilon as RenderGridBeat's firing rule, so a beat the render loop
  // considers already crossed is never seeked back onto.
  const auto first_at_or_after =
      std::lower_bound(times.begin(), times.end(), song_seconds - kGridEpsilon);
  grid_state_.cursor = static_cast<size_t>(first_at_or_after - times.begin());
  grid_state_.beat_index = static_cast<int64_t>(grid_state_.cursor) - 1;
  ResyncSub(grid, song_seconds);
  SyncGridBar(grid);
}

bool Metronome::GridShiftReplays(const BeatGrid& grid, double shift_sec) const {
  const auto& times = grid.beat_times_sec;
  if (shift_sec >= 0.0 || times.size() < 2) return false;
  const size_t next = Clamp<size_t>(grid_state_.cursor, 1, times.size() - 1);
  const double replay_threshold_sec = times[next] - times[next - 1];
  return -shift_sec + kGridEpsilon >= replay_threshold_sec;
}

// Derived from the song's bars, never incremented: a re-anchor re-crosses
// downbeats, and counting them would tie bar-mute phase to re-anchors (§4.2.1).
void Metronome::SyncGridBar(const BeatGrid& grid) {
  current_bar_ =
      grid_state_.beat_index < 0
          ? GridBar::kNoBar
          : grid.bars[static_cast<size_t>(grid_state_.beat_index)].bar;
}

bool Metronome::ApplyGridClickCommand(const Command& command) {
  if (command.type != CommandType::kSetGridClick) return false;
  if (grid_click_.Apply(command)) grid_state_.resync_sub = true;
  return true;
}

void Metronome::ResyncSub(const BeatGrid& grid, double song_seconds) {
  grid_state_.resync_sub = false;
  const size_t cursor = grid_state_.cursor;
  if (cursor == 0 || cursor >= grid.beat_times_sec.size()) {
    grid_state_.next_sub = 1;
    return;
  }
  grid_state_.next_sub = FirstSpanTick(
      grid.beat_times_sec,
      grid_click_.SpanAt(grid, cursor - 1),
      grid_click_.TicksPerSpan(subdivision_),
      song_seconds
  );
}

// The standalone accent row and its mutes are not the song's (SPEC.md §4.3).
void Metronome::OnGridBeat(const BeatGrid& grid, uint32_t sample_rate) {
  const auto beat = static_cast<size_t>(grid_state_.beat_index);
  current_beat_.store(grid.bars[beat].position, std::memory_order_relaxed);
  if (BarIsMuted(current_bar_)) return;
  switch (grid_click_.Level(grid, beat)) {
    case GridBeatLevel::kSilent:
      return;
    case GridBeatLevel::kNormal:
      TriggerSound(normal_sound_, ClickRole::kBeat, sample_rate);
      return;
    case GridBeatLevel::kGroup:
      TriggerSubdivisionVoice(Accent::kAccented, sample_rate);
      return;
    case GridBeatLevel::kBar:
      TriggerSound(accent_sound_, ClickRole::kAccent, sample_rate);
      return;
  }
}

void Metronome::OnGridTick(int tick, uint32_t sample_rate) {
  if (grid_click_.IsHalfBeat(tick, subdivision_)) {
    TriggerSound(normal_sound_, ClickRole::kBeat, sample_rate);
    return;
  }
  TriggerSubdivision(subdivision_, tick % subdivision_, sample_rate);
}

void Metronome::RenderGridBeat(
    const BeatGrid& grid,
    double song_seconds,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  if (grid_state_.resync_sub) ResyncSub(grid, song_seconds);
  if (!BeatDue(times, grid_state_, song_seconds)) {
    RenderGridSubdivision(grid, song_seconds, sample_rate);
    return;
  }

  // Advance past beats the grid packs closer than one sample so a dense grid
  // cannot fire twice for one frame — but count every one, or the bar drifts.
  while (BeatDue(times, grid_state_, song_seconds)) {
    ++grid_state_.cursor;
    ++grid_state_.beat_index;
  }
  SyncGridBar(grid);
  const auto beat = static_cast<size_t>(grid_state_.beat_index);
  const bool opens_span = grid_click_.SpanAt(grid, beat).start == beat;
  if (opens_span) grid_state_.next_sub = 1;
  grid_state_.last_onset = {times[beat], grid.anchor_frame};
  // Re-anchoring the constant-tempo phase onto this beat is what makes
  // ClearGrid's "keeps its phase" true (SPEC.md §4.2.1).
  beat_position_ = static_cast<double>(grid_state_.beat_index) - LatencyBeats();
  OnGridBeat(grid, sample_rate);
  // A beat x1/2 silences sits inside its span; a tick may share its frame.
  if (!opens_span) RenderGridSubdivision(grid, song_seconds, sample_rate);
}

// Subdivisions divide the measured span, so they drift with the song the same
// way the beats do. Only inside a known span — outside there is none.
void Metronome::RenderGridSubdivision(
    const BeatGrid& grid,
    double song_seconds,
    uint32_t sample_rate
) {
  const auto& times = grid.beat_times_sec;
  const int ticks = grid_click_.TicksPerSpan(subdivision_);
  if (ticks <= 1 || grid_state_.cursor == 0 ||
      grid_state_.cursor >= times.size() || grid_state_.next_sub >= ticks) {
    return;
  }
  const GridSpan span = grid_click_.SpanAt(grid, grid_state_.cursor - 1);
  if (span.start + span.length >= times.size()) return;
  const double tick = SpanTickSeconds(times, span, grid_state_.next_sub, ticks);
  if (song_seconds + kGridEpsilon >= tick && tick <= grid_state_.fire_limit) {
    const int slot = grid_state_.next_sub++;
    grid_state_.last_onset = {tick, grid.anchor_frame};
    // The tick sits in [cursor-1, cursor]: current_bar_ is its owning beat's.
    if (!BarIsMuted(current_bar_)) OnGridTick(slot, sample_rate);
  }
}

// The sweep and the BPM readout must come from the same grid the click does,
// or the UI drifts against what is audible (§4.5).
void Metronome::PublishGridMirrors(const BeatGrid& grid, double song_seconds) {
  const auto& times = grid.beat_times_sec;
  // Outside any interval — before the first beat, or past the last, which every
  // song reaches — hold the last sweep and tempo rather than snapping to zero.
  if (grid_state_.cursor == 0 || grid_state_.cursor >= times.size()) return;
  const double previous = times[grid_state_.cursor - 1];
  const double interval = times[grid_state_.cursor] - previous;
  if (interval <= 0.0) return;

  // Same epsilon as BeatDue: the fired beat reads >= 0, the next one < 1. A
  // backward wait puts the position behind the fired beat; hold there.
  const double beat_fraction =
      std::max(0.0, (song_seconds + kGridEpsilon - previous) / interval);
  const GridBar& bar = grid.bars[grid_state_.cursor - 1];
  bar_phase_.store(
      PhaseBelowOne((bar.position + beat_fraction) / bar.length),
      std::memory_order_relaxed
  );
  // Clamped to the same range SetTempo enforces: a beat tracker emits outlier
  // intervals by nature, and this atomic is the tempo the UI reads out.
  const double rate =
      follow_mixer_ ? GridMapping::kRealTime : MappingFor(grid).rate;
  current_bpm_.store(
      Clamp(kSecondsPerMinute * rate / interval, kMinBpm, kMaxBpm),
      std::memory_order_relaxed
  );
}

namespace {

double FireLimitSec(const LoopLayout& layout, uint32_t sample_rate) {
  return layout.looping ? static_cast<double>(layout.end - 1) / sample_rate
                        : std::numeric_limits<double>::infinity();
}

// An onset ahead of the frame last heard belongs to a pass since wrapped, so no
// re-prime rewound over it.
double ContinuationSeekSec(
    const BeatGrid& grid,
    const GridState& state,
    double head_sec,
    uint32_t sample_rate
) {
  const double next_heard_sec =
      static_cast<double>(state.follow_last_frame + 1) / sample_rate;
  if (state.last_onset.song_sec > next_heard_sec) return head_sec;
  return std::max(head_sec, OnsetFloorSec(grid, state.last_onset));
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
    grid_state_.fire_limit = std::numeric_limits<double>::infinity();
    RenderGridBeat(grid, GridSeconds(grid, now, sample_rate), sample_rate);
    return;
  }
  if (song == nullptr || !song->Plays(frame)) return;
  const SongPoint point = song->PointAt(frame);
  const auto whole_frame = static_cast<double>(point.frame);
  grid_state_.follow_seconds = (whole_frame + point.fraction) / sample_rate;
  grid_state_.fire_limit = FireLimitSec(*point.layout, sample_rate);
  // Below 1.0x a song frame repeats, which is no jump. A new pass lands inside
  // a frame, so seek to its start or a beat right on the loop start is skipped.
  const int64_t step = point.frame - grid_state_.follow_last_frame;
  const bool opens_on_jump = song->OpensAt(frame);
  if (grid_state_.follow_last_frame == GridState::kReseedFollow ||
      opens_on_jump || step < 0 || step > 1) {
    const double head_sec = whole_frame / sample_rate;
    const bool continues = opens_on_jump && song->continues_run;
    if (opens_on_jump && !continues) custom_sounds_.CutAll();
    SeekGridCursor(
        grid,
        continues
            ? ContinuationSeekSec(grid, grid_state_, head_sec, sample_rate)
            : head_sec
    );
  }
  grid_state_.follow_last_frame = point.frame;
  RenderGridBeat(grid, grid_state_.follow_seconds, sample_rate);
}

}  // namespace kitbag
