// Grid mode: following measured beat times, re-anchoring, and returning to a
// constant tempo. The reasoning these pin is SPEC.md §4.2 / §4.2.1.
#include "metronome_test_util.h"

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
  bool swapped = false;
  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 4, [&](int64_t frame) {
        if (!swapped && frame >= swap_at) {
          metronome
              .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
          swapped = true;
        }
      });

  // Old grid through 2.0, then the new grid's first beat at or after the swap.
  const std::vector<double> expected =
      {0.0, 0.5, 1.0, 1.5, 2.0, 2.25, 2.75, 3.25, 3.75};
  Check(
      onsets.size() == expected.size(),
      "grid re-anchor: old beats then the new grid's future beats"
  );
  ExpectOnsetsAtSeconds(onsets, expected, "grid re-anchor");
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

  ExpectOnGrid(onsets, times, "grid stop/start");
  for (const int64_t onset : onsets) {
    Check(
        onset < stop_at + kBlockFrames || onset >= start_at,
        "grid stop/start: silent while stopped"
    );
  }
  Check(onsets.size() > 3, "grid stop/start: the click resumes");
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
  ExpectOnGrid(onsets, times, "grid + start_at");
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
  Check(
      onsets.size() == expected.size(),
      "grid start_at: no subdivision re-fired after the anchor block"
  );
  ExpectOnsetsAtSeconds(onsets, expected, "grid start_at subdivision");
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
  bool cleared = false;
  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 4, [&](int64_t frame) {
        if (!cleared && frame >= clear_at) {
          metronome.ClearGrid(static_cast<uint64_t>(frame), true);
          cleared = true;
        }
      });

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
  bool swapped = false;
  RenderContinuous(
      metronome,
      static_cast<int64_t>(2.7 * kSampleRate),
      [&](int64_t frame) {
        if (!swapped && frame >= swap_at) {
          metronome
              .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
          swapped = true;
        }
      }
  );

  // Beat 4 is the new grid's second downbeat: bar 1, which the trainer mutes.
  // Over-counting the re-crossed downbeat would report bar 2 — sounding.
  Check(
      metronome.bar_muted(),
      "grid re-anchor: bar-mute phase survives the re-anchor"
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

}  // namespace

void RunGridTests() {
  TestGridFollowsDriftingTempo();
  TestGridReanchorMidRunPicksUpNewGrid();
  TestClearGridReturnsToBpm();
  TestGridSurvivesStopStart();
  TestGridWithStartAt();
  TestGridStartAtKeepsSubdivisionCursor();
  TestGridSubdivision();
  TestGridReanchorKeepsBarPhase();
  TestGridBpmMirrorIsClamped();
}

}  // namespace metronome_test
