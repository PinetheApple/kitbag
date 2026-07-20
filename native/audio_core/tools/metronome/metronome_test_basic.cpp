// Constant-tempo sequencing: spacing, tempo changes, subdivisions, the two
// trainers and polyrhythm.
#include "metronome_test_util.h"

namespace metronome_test {
namespace {

void TestSteadyTempo() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 10);
  // 120 BPM = 2 clicks/s = 20 clicks in 10 s (first at frame 0).
  Check(onsets.size() == 20, "steady: expected 20 clicks in 10s at 120 BPM");
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "steady: first click at t=0"
  );
  ExpectSpacing(
      onsets,
      0,
      onsets.size(),
      60.0 / 120.0 * kSampleRate,
      "steady 120 BPM"
  );
}

void TestTempoChange() {
  kitbag::Metronome metronome;
  metronome.SetTempo(100.0);
  metronome.Start();

  auto first = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  ExpectSpacing(
      first,
      0,
      first.size(),
      60.0 / 100.0 * kSampleRate,
      "pre-change 100 BPM"
  );

  metronome.SetTempo(200.0);
  auto second = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  // Skip the straddling first interval; the rest must be exactly 200 BPM.
  ExpectSpacing(
      second,
      1,
      second.size(),
      60.0 / 200.0 * kSampleRate,
      "post-change 200 BPM"
  );
  Check(second.size() >= 18, "tempo change: clicks keep coming");
}

void TestSubdivisionAndMute() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(2);
  metronome.SetSubdivision(2);
  metronome.SetAccent(1, kitbag::Accent::kMuted);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
  // Bar = 1s: beat0 + its offbeat sound, beat1 muted entirely → 2 clicks/bar.
  Check(onsets.size() == 8, "subdivision+mute: 2 clicks per 1s bar over 4s");
  ExpectSpacing(onsets, 0, 2, 0.25 * kSampleRate, "eighth spacing");
}

// Intervals must shrink monotonically to the target, then hold there.
void ExpectRampIntervals(const std::vector<int64_t>& onsets, double target) {
  double previous = static_cast<double>(onsets[1] - onsets[0]);
  bool reached_target = false;
  for (size_t i = 2; i < onsets.size(); ++i) {
    const double spacing = static_cast<double>(onsets[i] - onsets[i - 1]);
    Check(
        spacing <= previous + kMaxJitterFrames,
        "ramp: intervals decrease monotonically"
    );
    if (std::fabs(spacing - target) <= kMaxJitterFrames) {
      reached_target = true;
    } else {
      Check(!reached_target, "ramp: holds end BPM once reached");
    }
    previous = spacing;
  }
  Check(reached_target, "ramp: reaches the end BPM");
}

void TestTempoRamp() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetRamp(true, 100.0, 200.0, 4);
  metronome.Start();

  // Bar BPMs: 100, 125, 150, 175, then 200 held. ~21 s covers it all.
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 21);
  Check(onsets.size() >= 24, "ramp: enough clicks to cover all ramp bars");
  if (onsets.size() < 2) return;

  const double target = 60.0 / 200.0 * kSampleRate;
  ExpectRampIntervals(onsets, target);
  ExpectSpacing(
      onsets,
      onsets.size() - 4,
      onsets.size(),
      target,
      "ramp end 200 BPM"
  );
}

// A per-bar ramp step must take effect on the sample the downbeat fires, not
// at the next block boundary. The bar edge falls mid-block here, and the step
// is large, so a deferred step shows up as a short first beat of bar 1.
void TestRampStepTakesEffectMidBlock() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetRamp(true, 240.0, 60.0, 1);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  Check(onsets.size() >= 8, "ramp step: enough clicks to span both bars");
  ExpectSpacing(onsets, 0, 4, 60.0 / 240.0 * kSampleRate, "ramp bar 0 at 240");
  ExpectSpacing(onsets, 4, 7, 60.0 / 60.0 * kSampleRate, "ramp bar 1 at 60");
}

void TestBarMute() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.SetBarMute(true, 1, 1);
  metronome.Start();

  // Bar = 2 s. Play 1, mute 1 → 4 clicks in even bars, silence in odd bars.
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 8);
  Check(onsets.size() == 8, "bar mute: 4 clicks per sounding bar over 8s");
  const int64_t bar_frames = 2 * kSampleRate;
  for (const int64_t onset : onsets) {
    Check(onset / bar_frames % 2 == 0, "bar mute: muted bars stay silent");
  }
}

void TestPolyrhythm() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.SetPolyrhythm(true, 3);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 8);
  // Per 2s bar: 4 main + 3 poly, minus coinciding downbeat (one onset) = 6.
  Check(onsets.size() == 24, "3:4 poly: 6 onsets per bar over 4 bars");
}

}  // namespace

void RunBasicTests() {
  TestSteadyTempo();
  TestTempoChange();
  TestSubdivisionAndMute();
  TestTempoRamp();
  TestRampStepTakesEffectMidBlock();
  TestBarMute();
  TestPolyrhythm();
}

}  // namespace metronome_test
