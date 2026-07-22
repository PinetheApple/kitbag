// Grid mode: following measured beat times, re-anchoring, and returning to a
// constant tempo. The reasoning these pin is SPEC.md §4.2 / §4.2.1.
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

// The click follows the grid's per-beat spacing, not a single BPM.
void TestGridFollowsDriftingTempo() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);  // deliberately unrelated to the grid
  metronome.SetBeatsPerBar(4);
  auto grid = MakeDriftingGrid(12, 0.5, 0.02, 0);
  const auto expected = grid->beat_times_sec;
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 5);
  Check(onsets.size() == expected.size(), "grid: one click per grid beat");
  ExpectOnsetsAtSeconds(onsets, expected, "grid drift");
}

// A grid swapped mid-run re-seeds from the current position: the next future
// beat of the new grid fires, and beats already played are never revisited.
void TestGridReanchorMidRunPicksUpNewGrid() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  // Same tempo, offset by a quarter second: every future beat moves.
  auto shifted = MakeShiftedGrid(40, 0.25, 0.5);
  // Between beats, so neither grid's beat is ambiguous at the swap.
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  const auto onsets = RenderContinuous(
      metronome,
      kSampleRate * 4,
      OnceAtFrame(swap_at, [&](int64_t frame) {
        metronome
            .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
      })
  );

  // Old grid through 2.0, then the new grid's first beat at or after the swap.
  const std::vector<double> expected =
      {0.0, 0.5, 1.0, 1.5, 2.0, 2.25, 2.75, 3.25, 3.75};
  Check(
      onsets.size() == expected.size(),
      "grid re-anchor: old beats then the new grid's future beats"
  );
  ExpectOnsetsAtSeconds(onsets, expected, "grid re-anchor");
}

// Even grid beats before the re-seed, then the incoming grid's own beats from it
// on — derived from the grid, not a rounded literal, so a steep ramp cannot be
// swallowed by fixture values too round to discriminate. The re-seed runs at the
// first block boundary at or after swap_at.
std::vector<double>
DriftingReanchorExpected(const std::vector<double>& incoming, int64_t swap_at) {
  const int64_t seed_frame =
      ((swap_at + kBlockFrames - 1) / kBlockFrames) * kBlockFrames;
  const double seed_sec = static_cast<double>(seed_frame) / kSampleRate;
  std::vector<double> expected = {0.0, 0.5, 1.0, 1.5, 2.0};
  for (const double t : incoming) {
    if (t >= seed_sec - 1e-9) expected.push_back(t);
  }
  return expected;
}

// Re-anchoring mid-run to a genuinely *drifting* grid: the existing re-anchor
// tests swap between even grids, so an impl that re-seeded onto an averaged tempo
// would pass them. Here the incoming grid ramps, so every post-swap beat must land
// on its own measured time, not on an extrapolation from the re-seed point.
void TestGridReanchorFollowsNewDriftingGrid() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetGrid(MakeShiftedGrid(40, 0.0, 0.5), 0, true);  // even 0.5 s
  metronome.Start();
  // Steep ramp: intervals shrink 0.02 s per beat, so an averaged-tempo re-seed misses.
  auto drifting = MakeDriftingGrid(12, 0.5, 0.02, 0);
  const auto incoming = drifting->beat_times_sec;
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  const auto onsets = RenderContinuous(
      metronome,
      kSampleRate * 5,
      OnceAtFrame(swap_at, [&](int64_t frame) {
        metronome
            .SetGrid(std::move(drifting), static_cast<uint64_t>(frame), true);
      })
  );
  const auto expected = DriftingReanchorExpected(incoming, swap_at);
  Check(
      onsets.size() == expected.size(),
      "grid drifting re-anchor: beat count"
  );
  ExpectOnsetsAtSeconds(onsets, expected, "grid drifting re-anchor");
}

// Regression: pausing and resuming under a grid must not strand the cursor
// where the pause began (SPEC.md §4.2.1).
void TestGridSurvivesStopStart() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  auto grid = MakeDriftingGrid(40, 0.5, 0.0, 0);
  const auto times = grid->beat_times_sec;
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.Start();

  const int64_t stop_at = static_cast<int64_t>(1.2 * kSampleRate);
  const int64_t start_at = static_cast<int64_t>(2.6 * kSampleRate);
  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 5, [&](int64_t frame) {
        if (frame >= stop_at && frame < stop_at + kBlockFrames) {
          metronome.Stop();
        } else if (frame >= start_at && frame < start_at + kBlockFrames) {
          metronome.Start();
        }
      });

  // Beats at 0.0/0.5/1.0, then from the resume 3.0/3.5/4.0/4.5/5.0.
  ExpectOnGrid(onsets, times, 8, "grid stop/start");
  for (const int64_t onset : onsets) {
    Check(
        onset < stop_at + kBlockFrames || onset >= start_at,
        "grid stop/start: silent while stopped"
    );
  }
}

// StartAt under a grid seeds the cursor at the anchor, not at the block the
// grid arrived in.
void TestGridWithStartAt() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  auto grid = MakeDriftingGrid(40, 0.5, 0.0, 0);
  const auto times = grid->beat_times_sec;
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.StartAt(static_cast<uint64_t>(1.1 * kSampleRate));

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
  // The anchor at 1.1 s skips 0.0 through 1.0, leaving at least 1.5 through 3.5.
  ExpectOnGrid(onsets, times, 5, "grid + start_at");
  Check(
      !onsets.empty() && onsets[0] >= static_cast<int64_t>(1.1 * kSampleRate),
      "grid + start_at: nothing sounds before the anchor"
  );
}

// After a deferred start the cursor must stay seeded, generation included: a
// block that re-seeds resets grid_next_sub_ and re-fires a spent subdivision.
void TestGridStartAtKeepsSubdivisionCursor() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.StartAt(static_cast<uint64_t>(1.1 * kSampleRate));

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
  // From the anchor: offbeat 1.25, then beats and offbeats every 0.25 s.
  const std::vector<double> expected =
      {1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75};
  ExpectOnsetsAtSeconds(onsets, expected, "grid start_at subdivision");
}

// The anchor lands in the same block as a subdivision and just before it, so a
// lost generation re-seeds the next block and re-fires that spent subdivision.
// The re-fire is ~160 frames later — inside kOnsetHoldFrames, so it is invisible
// to the onset detector and only the block envelope can see it.
void TestGridStartAtRestoresGeneration() {
  constexpr double kSubTickSec = 1.25;
  constexpr int64_t kJustBeforeFrames = 50;
  constexpr size_t kDecayBlocks = 25;
  const auto tick_frame = static_cast<int64_t>(kSubTickSec * kSampleRate);

  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.StartAt(static_cast<uint64_t>(tick_frame - kJustBeforeFrames));

  const auto peaks =
      RenderContinuousPeaks(metronome, kSampleRate * 4, [](int64_t) {});
  const auto tick_block = static_cast<size_t>(tick_frame / kBlockFrames);
  Check(
      peaks[tick_block] > 0.0,
      "grid start_at generation: the anchor block's subdivision sounds"
  );
  ExpectDecayingBlocks(
      peaks,
      tick_block,
      tick_block + kDecayBlocks,
      "grid start_at generation: no subdivision re-fired after the anchor block"
  );
}

// Subdivisions divide each measured interval rather than being dropped.
void TestGridSubdivision() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetGrid(MakeDriftingGrid(20, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  // Beats at 0.0/0.5/1.0/1.5 plus offbeats at 0.25/0.75/1.25/1.75.
  Check(onsets.size() == 8, "grid subdivision: beats and offbeats both sound");
  ExpectSpacing(
      onsets,
      0,
      onsets.size(),
      0.25 * kSampleRate,
      "grid subdivision spacing"
  );
}

// Clearing returns to constant tempo *in phase*, cleared at a non-beat instant
// because clearing on a beat hides the defect this pins (SPEC.md §4.2.1).
void TestClearGridReturnsToBpm() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);  // 0.5 s beats
  metronome.SetBeatsPerBar(4);
  // 0.3 s beats: incommensurate with the 0.5 s tempo, so continuing from the
  // last grid beat and free-running from the transport disagree.
  metronome.SetGrid(MakeDriftingGrid(40, 0.3, 0.0, 0), 0, true);
  metronome.Start();

  const int64_t clear_at = static_cast<int64_t>(2.05 * kSampleRate);
  const auto onsets = RenderContinuous(
      metronome,
      kSampleRate * 4,
      OnceAtFrame(clear_at, [&](int64_t frame) {
        metronome.ClearGrid(static_cast<uint64_t>(frame), true);
      })
  );

  // The grid's own beats through 1.8, then 120 BPM continuing from that beat —
  // and nothing at the clear instant itself.
  const std::vector<double> expected =
      {0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.3, 2.8, 3.3, 3.8};
  Check(
      onsets.size() == expected.size(),
      "clear grid: grid beats, then the constant tempo in phase"
  );
  ExpectOnsetsAtSeconds(onsets, expected, "clear grid");
}

// The bar counter must be derived from the grid's beat numbering, not counted:
// a re-anchor re-crosses a downbeat and counting would over-count (§4.2.1).
void TestGridReanchorKeepsBarPhase() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetBarMute(true, 1, 1);  // odd bars silent, even bars sounding
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  // Shifted 0.4 s later, so the re-anchor lands the cursor back on beat 4 — a
  // downbeat already crossed once on the outgoing grid.
  auto shifted = MakeShiftedGrid(40, 0.4, 0.5);
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  RenderContinuous(
      metronome,
      static_cast<int64_t>(2.7 * kSampleRate),
      OnceAtFrame(swap_at, [&](int64_t frame) {
        metronome
            .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
      })
  );

  // Beat 4 is the new grid's second downbeat: bar 1, which the trainer mutes.
  // Over-counting the re-crossed downbeat would report bar 2 — sounding.
  Check(
      metronome.bar_muted(),
      "grid re-anchor: bar-mute phase survives the re-anchor"
  );
}

// A grid re-anchor's "no double beat" needs the block envelope, not onset
// counting: a re-fire inside kOnsetHoldFrames of the swap is invisible to the
// onset detector (cf. C3's anchor_external case).
void TestGridReanchorNoRefire() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  auto shifted =
      MakeShiftedGrid(40, 0.35, 0.5);  // next beat 2.35, past the swap
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  const auto peaks = RenderContinuousPeaks(
      metronome,
      kSampleRate * 4,
      OnceAtFrame(swap_at, [&](int64_t frame) {
        metronome
            .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
      })
  );

  // Start before the swap so a rise at the swap block is caught, and end while
  // the previous click is still decaying — before it retires to a flat zero and
  // before the new grid's 2.35 s beat legitimately sounds.
  const size_t swap_block = static_cast<size_t>(swap_at / kBlockFrames) + 1;
  ExpectDecayingBlocks(
      peaks,
      swap_block - 4,
      swap_block + 20,
      "grid re-anchor: no click re-fired at the swap"
  );
}

// A beat tracker emits outlier intervals by nature, and current_bpm_ is what
// the UI reads out, so grid mode must clamp it the way SetTempo does.
void TestGridBpmMirrorIsClamped() {
  kitbag::Metronome fast;
  fast.SetBeatsPerBar(4);
  fast.SetGrid(MakeDriftingGrid(200, 0.05, 0.0, 0), 0, true);  // 1200 BPM raw
  fast.Start();
  RenderAndDetectOnsets(fast, kSampleRate / 2);
  Check(
      fast.current_bpm() == kitbag::Metronome::kMaxBpm,
      "grid bpm mirror: a too-short interval clamps to kMaxBpm"
  );

  kitbag::Metronome slow;
  slow.SetBeatsPerBar(4);
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec = {0.0, 10.0};  // 6 BPM raw
  slow.SetGrid(std::move(grid), 0, true);
  slow.Start();
  RenderAndDetectOnsets(slow, kSampleRate);
  Check(
      slow.current_bpm() == kitbag::Metronome::kMinBpm,
      "grid bpm mirror: a too-long interval clamps to kMinBpm"
  );
}

// A click definitely sounding, not merely brushing the onset floor: 4x
// kOnsetThreshold, so a live subdivision clears it but a decay tail cannot.
constexpr double kGridSoundingPeak = 0.2;

// #24 (a #21 follow-up): the grid path attributes a subdivision to the interval
// it divides, grid_beat_index_ (the left-endpoint beat). A measured 0.15 s grid
// (bpm 400) offset into the future so beats 0 and 1 both sound cleanly under the
// offset. At +100 ms the latency spans 2/3 of a beat, so an owning beat off by
// one would sound a muted beat's own subdivision.
double GridMuteCascadePeak(kitbag::Accent beat_one, int64_t lo, int64_t hi) {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetLatencyOffset(100.0);
  metronome.SetAccent(1, beat_one);
  metronome.SetGrid(MakeShiftedGrid(8, 0.2, 0.15), 0, true);
  metronome.Start();
  return WindowedPeak(metronome, lo, hi);
}

// Grid analogue of TestMutedBeatCascadesToSubdivision. Beat 1's subdivision
// fires near frame 15600; muting beat 1 must silence it on the speaker-time
// base, while beat 0's subdivision (near frame 8400) keeps sounding.
void TestGridMutedBeatCascadesToSubdivision() {
  const double leaked =
      GridMuteCascadePeak(kitbag::Accent::kMuted, 15200, 16200);
  Check(
      leaked < kOnsetThreshold,
      "grid mute cascade: muting beat 1 silences its own subdivision under "
      "+100 ms"
  );
  const double sounding =
      GridMuteCascadePeak(kitbag::Accent::kNormal, 15200, 16200);
  Check(
      sounding > kGridSoundingPeak,
      "grid mute cascade: beat 1's subdivision sounds when it is not muted"
  );
  const double beat_zero_sub =
      GridMuteCascadePeak(kitbag::Accent::kMuted, 8000, 9000);
  Check(
      beat_zero_sub > kGridSoundingPeak,
      "grid mute cascade: muting beat 1 leaves beat 0's subdivision sounding"
  );
}

}  // namespace

void RunGridTests() {
  TestGridFollowsDriftingTempo();
  TestGridReanchorMidRunPicksUpNewGrid();
  TestGridReanchorFollowsNewDriftingGrid();
  TestClearGridReturnsToBpm();
  TestGridSurvivesStopStart();
  TestGridWithStartAt();
  TestGridStartAtKeepsSubdivisionCursor();
  TestGridStartAtRestoresGeneration();
  TestGridSubdivision();
  TestGridReanchorKeepsBarPhase();
  TestGridReanchorNoRefire();
  TestGridBpmMirrorIsClamped();
  TestGridMutedBeatCascadesToSubdivision();
}

}  // namespace metronome_test
