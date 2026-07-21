// Output-latency compensation (SPEC.md §4.7). Every check here pins a defect
// that reproduced inside the existing ±100 ms clamp.
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

// An offset must not swallow the downbeat (regression: +0.5 ms ate beat 0).
void TestLatencyOffsetKeepsBeatZero() {
  for (const double offset_ms : {0.5, 50.0, 100.0, -50.0, -100.0}) {
    kitbag::Metronome metronome;
    metronome.SetTempo(120.0);
    metronome.SetLatencyOffset(offset_ms);
    metronome.Start();

    const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
    Check(
        !onsets.empty() && onsets[0] < kOnsetHoldFrames,
        "latency: downbeat still fires under an offset"
    );
    Check(onsets.size() == 8, "latency: no beats swallowed or added at start");
    ExpectSpacing(
        onsets,
        0,
        onsets.size(),
        60.0 / 120.0 * kSampleRate,
        "latency offset spacing"
    );
  }
}

// Changing the offset mid-run must not step the grid sideways. Bar mute makes
// a corrupted bar counter observable; the change lands on a downbeat.
void CheckMidRunOffsetChange(double new_offset) {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.SetBarMute(true, 1, 1);
  metronome.Start();

  const int64_t change_at = kSampleRate * 2;
  bool applied = false;
  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 8, [&](int64_t frame) {
        if (!applied && frame >= change_at) {
          metronome.SetLatencyOffset(new_offset);
          applied = true;
        }
      });

  // Play 1 / mute 1 → 4 clicks per sounding bar, 8 over four bars.
  Check(
      onsets.size() == 8,
      "mid-run offset: no click added or dropped, bar-mute phase intact"
  );
  ExpectSpacing(onsets, 0, 4, 60.0 / 120.0 * kSampleRate, "mid-run offset");
}

void TestLatencyOffsetChangedMidRun() {
  CheckMidRunOffsetChange(50.0);
  CheckMidRunOffsetChange(-50.0);
}

// A constant offset must leave a ramp's grid identical to the no-offset ramp.
// Ramping down is the direction where a regression double-fires.
void TestLatencyOffsetSurvivesRamp() {
  kitbag::Metronome baseline;
  baseline.SetBeatsPerBar(4);
  baseline.SetRamp(true, 240.0, 120.0, 1);
  baseline.Start();
  const auto without = RenderAndDetectOnsets(baseline, kSampleRate * 5);

  kitbag::Metronome offset;
  offset.SetBeatsPerBar(4);
  offset.SetLatencyOffset(100.0);
  offset.SetRamp(true, 240.0, 120.0, 1);
  offset.Start();
  const auto with = RenderAndDetectOnsets(offset, kSampleRate * 5);

  Check(
      without.size() == with.size(),
      "latency+ramp: offset does not add or drop onsets"
  );
  const size_t count = std::min(without.size(), with.size());
  for (size_t i = 0; i < count; ++i) {
    Check(
        std::abs(with[i] - without[i]) <= 1,
        "latency+ramp: onset grid matches the no-offset ramp"
    );
  }
}

// Grid mode must compose with the latency offset too (§4.7): every grid test
// above ran at zero offset, so GridSeconds' offset term was unpinned. Each click
// fires early by the offset so it lands on the beat at the speaker.
void TestGridComposesWithLatency() {
  for (const double offset_ms : {100.0, -50.0}) {
    kitbag::Metronome metronome;
    metronome.SetBeatsPerBar(4);
    auto grid = MakeShiftedGrid(8, 0.5, 0.5);
    const auto times = grid->beat_times_sec;
    metronome.SetLatencyOffset(offset_ms);
    metronome.SetGrid(std::move(grid), 0, true);
    metronome.Start();

    const int64_t total = kSampleRate * 3;
    const auto onsets = RenderAndDetectOnsets(metronome, total);
    std::vector<double> expected;
    const double offset_sec = offset_ms / 1000.0;
    for (const double t : times) {
      const double frame = (t - offset_sec) * kSampleRate;
      if (frame >= 0.0 && frame < static_cast<double>(total)) {
        expected.push_back(frame / kSampleRate);
      }
    }
    ExpectOnsetsAtSeconds(onsets, expected, "grid composes with latency");
  }
}

// A grid swap mid-run under an offset, compared against the same swap at zero
// offset: the offset must shift every click uniformly early — after the
// re-anchor too, not only before it.
std::vector<int64_t> RunGridReanchorWithOffset(double offset_ms) {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetLatencyOffset(offset_ms);
  metronome.SetGrid(MakeShiftedGrid(12, 0.5, 0.5), 0, true);
  metronome.Start();
  auto shifted = MakeShiftedGrid(12, 2.35, 0.5);  // next beat past the swap
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  return RenderContinuous(
      metronome,
      kSampleRate * 4,
      OnceAtFrame(swap_at, [&](int64_t frame) {
        metronome
            .SetGrid(std::move(shifted), static_cast<uint64_t>(frame), true);
      })
  );
}

// Purely differential: it asserts the offset shifts every click uniformly, and
// leans on TestGridReanchorMidRunPicksUpNewGrid to pin that the post-swap clicks
// land on the *new* grid at all.
void TestGridReanchorComposesWithLatency() {
  const double offset_ms = 100.0;
  const auto base = RunGridReanchorWithOffset(0.0);
  const auto shifted = RunGridReanchorWithOffset(offset_ms);
  const double expected_shift =
      offset_ms / 1000.0 * kSampleRate;  // fires early
  Check(
      !base.empty() && base.size() == shifted.size(),
      "grid re-anchor + latency: offset changes no onset count"
  );
  double max_dev = 0.0;
  const size_t count = std::min(base.size(), shifted.size());
  for (size_t i = 0; i < count; ++i) {
    max_dev = std::max(
        max_dev,
        std::fabs(static_cast<double>(base[i] - shifted[i]) - expected_shift)
    );
  }
  Check(
      max_dev <= 2.0 * kGridToleranceFrames,
      "grid re-anchor + latency: every click shifts early by the offset"
  );
}

}  // namespace

void RunLatencyTests() {
  TestLatencyOffsetKeepsBeatZero();
  TestLatencyOffsetChangedMidRun();
  TestLatencyOffsetSurvivesRamp();
  TestGridComposesWithLatency();
  TestGridReanchorComposesWithLatency();
}

}  // namespace metronome_test
