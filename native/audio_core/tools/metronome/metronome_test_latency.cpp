// Output-latency compensation (SPEC.md §4.7). Every check here pins a defect
// that reproduced inside the existing ±100 ms clamp.
#include "metronome_test_util.h"

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

}  // namespace

void RunLatencyTests() {
  TestLatencyOffsetKeepsBeatZero();
  TestLatencyOffsetChangedMidRun();
  TestLatencyOffsetSurvivesRamp();
}

}  // namespace metronome_test
