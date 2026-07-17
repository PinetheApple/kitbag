// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land on the beat grid, including across a tempo change.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "../src/metronome.h"

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kBlockFrames = 256;
constexpr double kOnsetThreshold = 0.05;
// A click is one onset; the window must outlast the click's decay tail
// (~4600 frames at the slowest preset) while staying under the smallest
// inter-click gap in these tests (12000 frames).
constexpr int kOnsetHoldFrames = 6000;
constexpr double kMaxJitterFrames = 1.5;

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

std::vector<int64_t> RenderAndDetectOnsets(kitbag::Metronome& metronome,
                                           int64_t total_frames) {
  std::vector<int64_t> onsets;
  std::vector<float> buffer(kBlockFrames * kChannels);
  int64_t rendered = 0;
  int64_t last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(buffer.data(), kBlockFrames, kSampleRate, kChannels);
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      const float amplitude = std::fabs(buffer[frame * kChannels]);
      const int64_t index = rendered + frame;
      if (amplitude > kOnsetThreshold && previous_abs <= kOnsetThreshold &&
          index - last_onset >= kOnsetHoldFrames) {
        onsets.push_back(index);
        last_onset = index;
      }
      previous_abs = amplitude;
    }
    rendered += kBlockFrames;
  }
  return onsets;
}

void ExpectSpacing(const std::vector<int64_t>& onsets, size_t from, size_t to,
                   double expected_frames, const char* label) {
  for (size_t i = from + 1; i < to && i < onsets.size(); ++i) {
    const double spacing = static_cast<double>(onsets[i] - onsets[i - 1]);
    if (std::fabs(spacing - expected_frames) > kMaxJitterFrames) {
      std::fprintf(stderr, "FAIL: %s interval %zu = %.1f, expected %.1f\n",
                   label, i, spacing, expected_frames);
      ++g_failures;
      return;
    }
  }
}

void TestSteadyTempo() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 10);
  // 120 BPM = 2 clicks/s = 20 clicks in 10 s (first at frame 0).
  Check(onsets.size() == 20, "steady: expected 20 clicks in 10s at 120 BPM");
  Check(!onsets.empty() && onsets[0] < kOnsetHoldFrames,
        "steady: first click at t=0");
  ExpectSpacing(onsets, 0, onsets.size(), 60.0 / 120.0 * kSampleRate,
                "steady 120 BPM");
}

void TestTempoChange() {
  kitbag::Metronome metronome;
  metronome.SetTempo(100.0);
  metronome.Start();

  auto first = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  ExpectSpacing(first, 0, first.size(), 60.0 / 100.0 * kSampleRate,
                "pre-change 100 BPM");

  metronome.SetTempo(200.0);
  auto second = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  // Skip the straddling first interval; the rest must be exactly 200 BPM.
  ExpectSpacing(second, 1, second.size(), 60.0 / 200.0 * kSampleRate,
                "post-change 200 BPM");
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

void TestTempoRamp() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetRamp(true, 100.0, 200.0, 4);
  metronome.Start();

  // Bar BPMs: 100, 125, 150, 175, then 200 held. ~21 s covers it all.
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 21);
  Check(onsets.size() >= 24, "ramp: enough clicks to cover all ramp bars");
  if (onsets.size() < 2) {
    return;
  }

  // Intervals must shrink monotonically (rising tempo) down to the target.
  const double target = 60.0 / 200.0 * kSampleRate;
  double previous = static_cast<double>(onsets[1] - onsets[0]);
  bool reached_target = false;
  for (size_t i = 2; i < onsets.size(); ++i) {
    const double spacing = static_cast<double>(onsets[i] - onsets[i - 1]);
    Check(spacing <= previous + kMaxJitterFrames,
          "ramp: intervals decrease monotonically");
    if (std::fabs(spacing - target) <= kMaxJitterFrames) {
      reached_target = true;
    } else {
      Check(!reached_target, "ramp: holds end BPM once reached");
    }
    previous = spacing;
  }
  Check(reached_target, "ramp: reaches the end BPM");
  ExpectSpacing(onsets, onsets.size() - 4, onsets.size(), target,
                "ramp end 200 BPM");
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

void TestLatencyOffsetKeepsBeatZero() {
  // An offset must not swallow the downbeat (regression: +0.5 ms ate beat 0).
  for (const double offset_ms : {0.5, 50.0, 100.0, -50.0, -100.0}) {
    kitbag::Metronome metronome;
    metronome.SetTempo(120.0);
    metronome.SetLatencyOffset(offset_ms);
    metronome.Start();

    const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
    Check(!onsets.empty() && onsets[0] < kOnsetHoldFrames,
          "latency: downbeat still fires under an offset");
    Check(onsets.size() == 8, "latency: no beats swallowed or added at start");
    ExpectSpacing(onsets, 0, onsets.size(), 60.0 / 120.0 * kSampleRate,
                  "latency offset spacing");
  }
}

void TestLatencyOffsetChangedMidRun() {
  // Changing the offset mid-run must not step the grid sideways (regression:
  // dragging the slider double-fired or dropped a click and skewed
  // current_bar_). Bar mute makes a corrupted bar counter observable.
  const double beat_frames = 60.0 / 120.0 * kSampleRate;  // 120 BPM
  for (const double new_offset : {50.0, -50.0}) {
    kitbag::Metronome metronome;
    metronome.SetTempo(120.0);
    metronome.SetBeatsPerBar(4);
    metronome.SetBarMute(true, 1, 1);
    metronome.Start();

    std::vector<float> buffer(kBlockFrames * kChannels);
    std::vector<int64_t> onsets;
    int64_t rendered = 0, last_onset = -kOnsetHoldFrames;
    float previous_abs = 0.0f;
    bool applied = false;
    const int64_t change_at =
        kSampleRate * 2;  // on a downbeat: worst case for the re-cross
    const int64_t total_frames = kSampleRate * 8;  // four bars
    while (rendered < total_frames) {
      std::fill(buffer.begin(), buffer.end(), 0.0f);
      if (!applied && rendered >= change_at) {
        metronome.SetLatencyOffset(new_offset);
        applied = true;
      }
      metronome.Render(buffer.data(), kBlockFrames, kSampleRate, kChannels);
      for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
        const float amplitude = std::fabs(buffer[frame * kChannels]);
        const int64_t index = rendered + frame;
        if (amplitude > kOnsetThreshold && previous_abs <= kOnsetThreshold &&
            index - last_onset >= kOnsetHoldFrames) {
          onsets.push_back(index);
          last_onset = index;
        }
        previous_abs = amplitude;
      }
      rendered += kBlockFrames;
    }
    // Play 1 / mute 1 → 4 clicks per sounding bar, 8 over four bars.
    Check(onsets.size() == 8,
          "mid-run offset: no click added or dropped, bar-mute phase intact");
    ExpectSpacing(onsets, 0, 4, beat_frames, "mid-run offset spacing");
  }
}

void TestLatencyOffsetSurvivesRamp() {
  // A latency offset and a tempo ramp used to corrupt each other: latency_beats
  // rescales with BPM, so a per-bar tempo step moved the phase sideways —
  // ramping down double-fired a downbeat (double-incrementing the bar counter),
  // ramping up dropped one. A constant offset must leave the ramp's grid
  // identical to the no-offset ramp. Ramp down so a regression double-fires.
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

  Check(without.size() == with.size(),
        "latency+ramp: offset does not add or drop onsets");
  const size_t count = std::min(without.size(), with.size());
  for (size_t i = 0; i < count; ++i) {
    Check(std::abs(with[i] - without[i]) <= 1,
          "latency+ramp: onset grid matches the no-offset ramp");
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

int main() {
  TestSteadyTempo();
  TestTempoChange();
  TestSubdivisionAndMute();
  TestLatencyOffsetKeepsBeatZero();
  TestLatencyOffsetChangedMidRun();
  TestLatencyOffsetSurvivesRamp();
  TestPolyrhythm();
  TestTempoRamp();
  TestBarMute();
  if (g_failures == 0) {
    std::printf("metronome_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "metronome_verify: %d failure(s)\n", g_failures);
  return 1;
}
