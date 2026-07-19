// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land on the beat grid, including across a tempo change.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <vector>

#include "../src/metronome.h"
#include "../src/rt_publisher.h"

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
// Grid beats are placed from doubles in seconds, so allow a couple of samples
// of rounding on top of the click's attack.
constexpr double kGridToleranceFrames = 4.0;

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

std::vector<int64_t>
RenderAndDetectOnsets(kitbag::Metronome& metronome, int64_t total_frames) {
  std::vector<int64_t> onsets;
  std::vector<float> buffer(kBlockFrames * kChannels);
  int64_t rendered = 0;
  int64_t last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
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

void ExpectSpacing(
    const std::vector<int64_t>& onsets,
    size_t from,
    size_t to,
    double expected_frames,
    const char* label
) {
  for (size_t i = from + 1; i < to && i < onsets.size(); ++i) {
    const double spacing = static_cast<double>(onsets[i] - onsets[i - 1]);
    if (std::fabs(spacing - expected_frames) > kMaxJitterFrames) {
      std::fprintf(
          stderr,
          "FAIL: %s interval %zu = %.1f, expected %.1f\n",
          label,
          i,
          spacing,
          expected_frames
      );
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
  ExpectSpacing(
      onsets,
      onsets.size() - 4,
      onsets.size(),
      target,
      "ramp end 200 BPM"
  );
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
      metronome.Render(
          buffer.data(),
          kBlockFrames,
          kSampleRate,
          kChannels,
          static_cast<uint64_t>(rendered)
      );
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
    Check(
        onsets.size() == 8,
        "mid-run offset: no click added or dropped, bar-mute phase intact"
    );
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

// StartAt must fire the first click on its exact engine frame, even when that
// frame falls mid-block — the whole point of the transport seam.
void TestStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  // 5000 is not a multiple of kBlockFrames (256): proves intra-block accuracy,
  // not just block-aligned starts.
  const int64_t anchor = 5000;
  metronome.StartAt(static_cast<uint64_t>(anchor));

  const auto onsets =
      RenderAndDetectOnsets(metronome, anchor + kSampleRate * 2);
  Check(!onsets.empty(), "start_at: the click actually starts");
  // The click's sine attacks from zero, so the threshold crossing lands one or
  // two samples after the anchor — never before it.
  Check(
      !onsets.empty() && onsets[0] >= anchor && onsets[0] <= anchor + 2,
      "start_at: first click on the anchor frame, not the call site"
  );
  ExpectSpacing(
      onsets,
      0,
      onsets.size(),
      60.0 / 120.0 * kSampleRate,
      "start_at 120 BPM after anchored start"
  );
}

// An anchor at (or before) the first rendered frame fires on frame 0, never
// retroactively — the same branch that handles an already-past anchor.
void TestStartAtAnchorAtZero() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(0);

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate);
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start_at(0): first click at frame 0"
  );
}

// Regression: a deferred start must recompute the per-block tempo/latency
// locals after the in-loop BeginRun. BeginRun sets beat_position_ =
// -LatencyBeats(reset bpm_); if the loop's latency_beats still reflects the
// pre-reset bpm_ (left high by a prior ramp run), `position` no longer cancels
// to zero on the first sample, so beat 0 is swallowed and the block runs at the
// stale tempo. A latency offset makes the mismatch observable — LatencyBeats
// scales with bpm_, so the two bpm values must differ for it to bite.
void TestStartAtWithArmedRampRecomputesLocals() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetRamp(true, 60.0, 180.0, 4);
  metronome.SetLatencyOffset(50.0);
  metronome.Start();
  RenderAndDetectOnsets(metronome, kSampleRate * 6);  // let bpm_ climb past 60
  metronome.Stop();  // leaves the ramp armed and bpm_ high

  const int64_t anchor = 5000;
  metronome.StartAt(static_cast<uint64_t>(anchor));
  const auto onsets =
      RenderAndDetectOnsets(metronome, anchor + kSampleRate * 3);
  // Beat 0 must still fire on the anchor (not swallowed by a stale offset), and
  // the first bar replays at ramp_start (60 BPM = 48000 frames/beat).
  Check(
      !onsets.empty() && onsets[0] >= anchor && onsets[0] <= anchor + 2,
      "start_at+ramp: beat 0 fires on the anchor, not swallowed"
  );
  Check(onsets.size() >= 3, "start_at+ramp: enough clicks to measure spacing");
  ExpectSpacing(
      onsets,
      0,
      3,
      60.0 / 60.0 * kSampleRate,
      "start_at+ramp: first bar at ramp start tempo, not stale bpm"
  );
}

// StartAt is dropped while already running.
void TestStartAtIgnoredWhileRunning() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  // Queued together: kStart begins immediately, then kStartAt sees running_ and
  // is dropped — so the run is continuous from frame 0, unshifted by the
  // anchor.
  metronome.Start();
  metronome.StartAt(
      kSampleRate
  );  // would move the start a second out, if honoured
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(
      onsets.size() == 4,
      "start_at while running: ignored, run stays continuous"
  );
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start_at while running: first click still at frame 0"
  );
}

// An immediate Start cancels a StartAt that has not fired yet. Ordering is the
// whole point: the pending start must already exist when kStart drains, which
// is the only path that reaches `has_pending_start_ = false` in kStart.
void TestStartCancelsPendingStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(kSampleRate);  // one second out...
  metronome.Start();               // ...but this pre-empts it
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start cancels pending start_at: first click at frame 0, not the anchor"
  );
  Check(
      onsets.size() == 4,
      "start cancels pending start_at: full continuous run, no second start"
  );
}

// A latency offset must not swallow beat 0 on the deferred path either — the
// immediate Start path has this pinned by TestLatencyOffsetKeepsBeatZero.
void TestStartAtKeepsBeatZeroUnderLatencyOffset() {
  for (const double offset_ms : {0.5, 100.0, -100.0}) {
    kitbag::Metronome metronome;
    metronome.SetTempo(120.0);
    metronome.SetLatencyOffset(offset_ms);
    const int64_t anchor = 5000;
    metronome.StartAt(static_cast<uint64_t>(anchor));

    const auto onsets =
        RenderAndDetectOnsets(metronome, anchor + kSampleRate * 2);
    Check(
        !onsets.empty() && onsets[0] >= anchor && onsets[0] <= anchor + 2,
        "start_at + latency offset: beat 0 fires on the anchor"
    );
    ExpectSpacing(
        onsets,
        0,
        onsets.size(),
        60.0 / 120.0 * kSampleRate,
        "start_at + latency offset spacing"
    );
  }
}

// Builds a grid whose beats accelerate: spacing shrinks by `shrink` each beat.
// A constant BPM cannot follow this, which is the point of grid mode.
std::unique_ptr<kitbag::BeatGrid> MakeDriftingGrid(
    int count,
    double first_interval,
    double shrink,
    uint64_t anchor_frame
) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  double t = 0.0;
  double interval = first_interval;
  for (int i = 0; i < count; ++i) {
    grid->beat_times_sec.push_back(t);
    t += interval;
    interval -= shrink;
  }
  grid->anchor_frame = anchor_frame;
  return grid;
}

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
  for (size_t i = 0; i < onsets.size() && i < expected.size(); ++i) {
    const double want = expected[i] * kSampleRate;
    if (std::fabs(static_cast<double>(onsets[i]) - want) >
        kGridToleranceFrames) {
      std::fprintf(
          stderr,
          "FAIL: grid beat %zu at %lld, expected %.0f\n",
          i,
          static_cast<long long>(onsets[i]),
          want
      );
      ++g_failures;
      break;
    }
  }
}

// A grid swapped mid-run re-seeds from the current position: the next future
// beat of the new grid fires, and beats already played are never revisited.
// Grid mode is driven by the absolute engine frame, so this renders one
// continuous frame range rather than reusing RenderAndDetectOnsets, which
// restarts the transport at frame 0 on every call.
void TestGridReanchorMidRunPicksUpNewGrid() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetGrid(
      MakeDriftingGrid(40, 0.5, 0.0, 0),
      0,
      true
  );  // beats on 0.5 s
  metronome.Start();

  // Same tempo, offset by a quarter second: every future beat moves.
  auto shifted = std::make_unique<kitbag::BeatGrid>();
  for (int i = 0; i < 40; ++i) {
    shifted->beat_times_sec.push_back(0.25 + 0.5 * i);
  }
  shifted->anchor_frame = 0;

  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<int64_t> onsets;
  int64_t rendered = 0, last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;
  bool swapped = false;
  // Between beats, so neither grid's beat is ambiguous at the swap.
  const int64_t swap_at = static_cast<int64_t>(2.1 * kSampleRate);
  const int64_t total = kSampleRate * 4;

  while (rendered < total) {
    if (!swapped && rendered >= swap_at) {
      metronome
          .SetGrid(std::move(shifted), static_cast<uint64_t>(rendered), true);
      swapped = true;
    }
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
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

  // Old grid through 2.0, then the new grid's first beat at or after the swap.
  const double expected[] = {0.0, 0.5, 1.0, 1.5, 2.0, 2.25, 2.75, 3.25, 3.75};
  const size_t expected_count = sizeof(expected) / sizeof(expected[0]);
  Check(
      onsets.size() == expected_count,
      "grid re-anchor: old beats then the new grid's future beats"
  );
  for (size_t i = 0; i < onsets.size() && i < expected_count; ++i) {
    const double want = expected[i] * kSampleRate;
    if (std::fabs(static_cast<double>(onsets[i]) - want) >
        kGridToleranceFrames) {
      std::fprintf(
          stderr,
          "FAIL: re-anchor beat %zu at %lld, expected %.0f\n",
          i,
          static_cast<long long>(onsets[i]),
          want
      );
      ++g_failures;
      break;
    }
  }
}

// Renders a continuous frame range, letting the caller act at frame
// boundaries. Grid mode is driven by the absolute engine frame, so grid tests
// cannot use RenderAndDetectOnsets, which restarts the transport at 0.
template <typename OnFrame>
std::vector<int64_t> RenderContinuous(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnFrame on_frame
) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<int64_t> onsets;
  int64_t rendered = 0, last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    on_frame(rendered);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
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

// Every onset must coincide with some beat in the grid.
void ExpectOnGrid(
    const std::vector<int64_t>& onsets,
    const std::vector<double>& times,
    const char* label
) {
  for (const int64_t onset : onsets) {
    bool matched = false;
    for (const double t : times) {
      if (std::fabs(static_cast<double>(onset) - t * kSampleRate) <=
          kGridToleranceFrames) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      std::fprintf(
          stderr,
          "FAIL: %s — onset %lld is not on any grid beat\n",
          label,
          static_cast<long long>(onset)
      );
      ++g_failures;
      return;
    }
  }
}

// Regression: pausing and resuming under a grid must not strand the cursor
// where the pause began. It used to swallow every beat spanned by the pause
// into a single click at the resume instant — off the grid entirely — and
// skip the bar counter past the downbeats it swallowed.
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
  // Nothing during the pause, and the grid resumes after it.
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

  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 4, [](int64_t) {});
  ExpectOnGrid(onsets, times, "grid + start_at");
  Check(
      !onsets.empty() && onsets[0] >= static_cast<int64_t>(1.1 * kSampleRate),
      "grid + start_at: nothing sounds before the anchor"
  );
}

// Subdivisions divide each measured interval rather than being dropped.
void TestGridSubdivision() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetGrid(MakeDriftingGrid(20, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  const auto onsets =
      RenderContinuous(metronome, kSampleRate * 2, [](int64_t) {});
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

// The publisher itself: generations advance and the payload survives.
void TestRtPublisher() {
  kitbag::RtPublisher<int> publisher;
  Check(publisher.Get() == nullptr, "publisher: empty until published");

  auto first = std::make_unique<int>(7);
  publisher.Publish(std::move(first), 0, true);
  const auto* a = publisher.Get();
  Check(a != nullptr && a->value == 7, "publisher: publishes the payload");
  Check(a->generation == 1, "publisher: first generation is 1");

  publisher.Publish(std::make_unique<int>(9), 0, true);
  const auto* b = publisher.Get();
  Check(b != nullptr && b->value == 9, "publisher: replaces the payload");
  Check(b->generation == 2, "publisher: generation advances on republish");

  publisher.Publish(nullptr, 0, true);
  Check(publisher.Get() == nullptr, "publisher: nullptr clears");

  publisher.ReclaimAll();
  Check(publisher.retired_size() == 0, "publisher: ReclaimAll empties retired");
}

// The reclamation policy, which is the one mechanism here whose failure mode is
// a use-after-free in the audio callback. Retired payloads must be held until
// the frame clock has moved a full grace window past the swap, and must then
// actually be freed rather than accumulating.
void TestRtPublisherReclamation() {
  const uint64_t grace = kitbag::RtPublisher<int>::kReclaimGraceFrames;
  kitbag::RtPublisher<int> publisher;

  publisher.Publish(std::make_unique<int>(1), 0, true);
  Check(publisher.retired_size() == 0, "reclaim: nothing retired by the first");
  publisher.Publish(std::make_unique<int>(2), 0, true);
  Check(publisher.retired_size() == 1, "reclaim: the replaced payload retires");
  publisher.Publish(std::make_unique<int>(3), 1000, true);
  Check(publisher.retired_size() == 2, "reclaim: nothing freed inside grace");

  // Exactly at the grace boundary the payload is still held: the predicate is
  // strictly greater-than, so a reader one frame short of the window is safe.
  publisher.Collect(grace);
  Check(publisher.retired_size() == 2, "reclaim: held at the grace boundary");

  // One frame past the oldest entry's window, and only it goes.
  publisher.Collect(grace + 1);
  Check(publisher.retired_size() == 1, "reclaim: freed one frame past grace");

  // Far past every window: the set empties.
  publisher.Collect(60000 + grace);
  Check(publisher.retired_size() == 0, "reclaim: all freed once well past");

  // With no reader — the engine never started, which is when a grid is usually
  // set — reclamation cannot wait on a clock that is not moving.
  kitbag::RtPublisher<int> stopped;
  for (int i = 0; i < 8; ++i) {
    stopped.Publish(std::make_unique<int>(i), 0, false);
  }
  Check(
      stopped.retired_size() == 0,
      "reclaim: publishing with no reader frees immediately"
  );
}

// Clearing the grid returns to constant-tempo mode *in phase*. Cleared at a
// non-beat instant — 2.1 s, deliberately not on a beat — because clearing on a
// beat hides the defect this pins: beat_position_ used to be frozen at its
// Start value all through grid mode, so the first sample after the clear read
// as a downbeat and fired immediately, shifting the bar.
void TestClearGridReturnsToBpm() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);  // 0.5 s beats
  metronome.SetBeatsPerBar(4);
  // 0.3 s beats: deliberately incommensurate with the 0.5 s constant tempo, so
  // continuing from the last grid beat and free-running from the start of the
  // transport give different answers. A grid whose spacing divides the tempo's
  // would let a broken anchor pass by coincidence.
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
  // 2.3, 2.8, 3.3, 3.8 — and nothing at the clear instant itself.
  const double expected[] =
      {0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.3, 2.8, 3.3, 3.8};
  const size_t expected_count = sizeof(expected) / sizeof(expected[0]);
  Check(
      onsets.size() == expected_count,
      "clear grid: grid beats, then the constant tempo in phase"
  );
  for (size_t i = 0; i < onsets.size() && i < expected_count; ++i) {
    const double want = expected[i] * kSampleRate;
    if (std::fabs(static_cast<double>(onsets[i]) - want) >
        kGridToleranceFrames) {
      std::fprintf(
          stderr,
          "FAIL: clear grid onset %zu at %lld, expected %.0f\n",
          i,
          static_cast<long long>(onsets[i]),
          want
      );
      ++g_failures;
      break;
    }
  }
}

// The bar counter must be a function of the grid's beat numbering, not a count
// of downbeats observed. A re-anchor that moves the cursor backwards re-crosses
// a downbeat, and an incrementing counter would over-count — making the
// bar-mute cycle's phase depend on how many times the user re-anchored.
void TestGridReanchorKeepsBarPhase() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetBarMute(true, 1, 1);  // odd bars silent, even bars sounding
  metronome.SetGrid(MakeDriftingGrid(40, 0.5, 0.0, 0), 0, true);
  metronome.Start();

  // Shifted 0.4 s later, so the re-anchor lands the cursor back on beat 4 — a
  // downbeat that has already been crossed once on the outgoing grid.
  auto shifted = std::make_unique<kitbag::BeatGrid>();
  for (int i = 0; i < 40; ++i) {
    shifted->beat_times_sec.push_back(0.4 + 0.5 * i);
  }
  shifted->anchor_frame = 0;

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
  {
    kitbag::Metronome fast;
    fast.SetBeatsPerBar(4);
    fast.SetGrid(MakeDriftingGrid(200, 0.05, 0.0, 0), 0, true);  // 1200 BPM raw
    fast.Start();
    RenderContinuous(fast, kSampleRate / 2, [](int64_t) {});
    Check(
        fast.current_bpm() == kitbag::Metronome::kMaxBpm,
        "grid bpm mirror: a too-short interval clamps to kMaxBpm"
    );
  }
  {
    kitbag::Metronome slow;
    slow.SetBeatsPerBar(4);
    auto grid = std::make_unique<kitbag::BeatGrid>();
    grid->beat_times_sec = {0.0, 10.0};  // 6 BPM raw
    slow.SetGrid(std::move(grid), 0, true);
    slow.Start();
    RenderContinuous(slow, kSampleRate, [](int64_t) {});
    Check(
        slow.current_bpm() == kitbag::Metronome::kMinBpm,
        "grid bpm mirror: a too-long interval clamps to kMinBpm"
    );
  }
}

// Stop cancels a pending StartAt: the click never begins.
void TestStopCancelsPendingStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(kSampleRate / 2);
  metronome.Stop();
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(onsets.empty(), "stop cancels pending start_at: no clicks");
}

}  // namespace

int main() {
  TestSteadyTempo();
  TestStartAt();
  TestStartAtAnchorAtZero();
  TestStartAtWithArmedRampRecomputesLocals();
  TestStartAtIgnoredWhileRunning();
  TestStartCancelsPendingStartAt();
  TestStartAtKeepsBeatZeroUnderLatencyOffset();
  TestGridFollowsDriftingTempo();
  TestGridReanchorMidRunPicksUpNewGrid();
  TestClearGridReturnsToBpm();
  TestGridSurvivesStopStart();
  TestGridWithStartAt();
  TestGridSubdivision();
  TestGridReanchorKeepsBarPhase();
  TestGridBpmMirrorIsClamped();
  TestRtPublisher();
  TestRtPublisherReclamation();
  TestStopCancelsPendingStartAt();
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
