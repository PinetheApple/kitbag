// Regression checks for two silent-corruption bugs found in a comment audit:
//
//  1. TrackBeats backtracked into a fixed 2048-entry stack buffer, stopping
//     when it filled. Because the backtrack walks BACKWARD from the last beat,
//     a track with more beats than that returned a grid whose first entry sat
//     minutes into the song — the origin shifted, silently.
//  2. The .kwav sidecar path used -4 arithmetic that stripped nothing from a
//     3-letter extension (song.wav → song.wav.kwav) and a char from .flac.
#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/sidecar_path.h"

namespace {

int g_failures = 0;
// Counted so a deleted TestX() call cannot pass silently: the total is a
// tripwire on the suite's own shape, not a derived expectation.
int g_checks = 0;

void Check(bool condition, const char* message) {
  ++g_checks;
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

void CheckPath(const char* dir, const char* song_path, const char* expected) {
  ++g_checks;
  const std::string got = kitbag::SidecarPath(dir, song_path);
  if (got != expected) {
    std::fprintf(
        stderr,
        "FAIL: SidecarPath(\"%s\", \"%s\") = \"%s\", "
        "wanted \"%s\"\n",
        dir,
        song_path,
        got.c_str(),
        expected
    );
    ++g_failures;
  }
}

constexpr float kHopTime = 512.0f / 48000.0f;
constexpr float kBpm = 120.0f;

// One unit-height onset spike every beat period, silence between: the DP has
// exactly one placement that maximises score, so the beat count is determined
// by the input rather than by the tracker's judgement.
std::vector<float> SyntheticOnsets(int beat_count) {
  const float period = 60.0f / (kBpm * kHopTime);
  const int period_frames = static_cast<int>(std::lround(period));
  std::vector<float> onset(
      static_cast<size_t>(beat_count) * period_frames + period_frames,
      0.0f
  );
  for (int i = 0; i < beat_count; ++i) {
    onset[static_cast<size_t>(i) * period_frames] = 1.0f;
  }
  return onset;
}

// Beats are spaced ~0.5 s at 120 BPM, so a grid anchored to the song's start
// has its first entry within one period of zero. A 2048-entry backward
// truncation of a 3000-beat track puts it near 476 s instead.
constexpr float kOriginTolerance = 1.0f;

void TestGridStaysAnchoredAtOrigin() {
  constexpr int kBeats = 3000;  // > the old 2048 ceiling, < KB_MAX_GRID_BEATS
  kitbag::BeatTracker tracker;
  const std::vector<float> beats =
      tracker.TrackBeats(SyntheticOnsets(kBeats), kHopTime, kBpm);

  Check(
      beats.size() > 2048,
      "a 3000-beat track returns more than the old 2048-beat ceiling"
  );
  Check(
      !beats.empty() && beats.front() < kOriginTolerance,
      "the first beat stays anchored near the start of the song"
  );
}

void TestTruncationDropsLateBeatsNotEarlyOnes() {
  constexpr int kBeats = KB_MAX_GRID_BEATS + 500;
  kitbag::BeatTracker tracker;
  const std::vector<float> beats =
      tracker.TrackBeats(SyntheticOnsets(kBeats), kHopTime, kBpm);

  Check(
      beats.size() == static_cast<size_t>(KB_MAX_GRID_BEATS),
      "an over-long track is capped at KB_MAX_GRID_BEATS"
  );
  Check(
      !beats.empty() && beats.front() < kOriginTolerance,
      "capping keeps the early beats, so the origin does not move"
  );
}

constexpr int kBusyBeats = 200;
constexpr float kBusyBaseline = 0.15f;
constexpr float kBusyOffbeat = 0.5f;
constexpr int kBusyMissable = 2;
constexpr float kMinGapPeriods = 0.75f;
constexpr float kSecondsPerMinute = 60.0f;
constexpr float kBusyTempos[] = {62.0f, 120.0f, 195.0f};

// Sustained sound keeps the onset above zero between beats, and an off-beat
// hit at half strength sits where a half-period grid would place its beats.
std::vector<float> BusyOnsets(float bpm, float* period_out) {
  const float period = kSecondsPerMinute / (bpm * kHopTime);
  *period_out = period;
  std::vector<float> onset(
      static_cast<size_t>(std::lround((kBusyBeats + 1) * period)),
      kBusyBaseline
  );
  for (int i = 0; i < kBusyBeats; ++i) {
    onset[static_cast<size_t>(std::lround(i * period))] = 1.0f;
    onset[static_cast<size_t>(std::lround((i + 0.5f) * period))] = kBusyOffbeat;
  }
  return onset;
}

void TestBusyOnsetsGetOneBeatPerPeriod() {
  for (const float bpm : kBusyTempos) {
    float period = 0.0f;
    const std::vector<float> onset = BusyOnsets(bpm, &period);
    const std::vector<float> beats =
        kitbag::BeatTracker().TrackBeats(onset, kHopTime, bpm);
    float min_gap = INFINITY;
    for (size_t i = 1; i < beats.size(); ++i) {
      min_gap = std::fmin(min_gap, beats[i] - beats[i - 1]);
    }
    std::printf(
        "beat_tracker_verify: busy %.0f BPM -> %zu beats of %d, min gap %.1f "
        "of %.1f hops\n",
        bpm,
        beats.size(),
        kBusyBeats,
        min_gap / kHopTime,
        period
    );
    Check(
        std::abs(static_cast<int>(beats.size()) - kBusyBeats) <= kBusyMissable,
        "busy onsets: one beat per period, not one per off-beat"
    );
    Check(
        min_gap >= kMinGapPeriods * period * kHopTime,
        "busy onsets: no gap shorter than three quarters of a period"
    );
  }
}

void TestSidecarPath() {
  // The extension lengths are the point: -4 arithmetic left .wav and .mp3
  // untouched and ate a character of the longer .flac and .opus.
  CheckPath("/wf", "/music/song.wav", "/wf/song.kwav");
  CheckPath("/wf", "/music/song.mp3", "/wf/song.kwav");
  CheckPath("/wf", "/music/song.flac", "/wf/song.kwav");
  CheckPath("/wf", "/music/song.opus", "/wf/song.kwav");

  CheckPath("/wf", "/music/song", "/wf/song.kwav");
  CheckPath("/wf", "/music/song.", "/wf/song.kwav");
  CheckPath("/wf", "/music/my.song.flac", "/wf/my.song.kwav");

  // A dot in a directory name is not an extension.
  CheckPath("/wf", "/my.music/song", "/wf/song.kwav");
  // A leading dot marks a hidden file; the name has no extension to strip.
  CheckPath("/wf", "/music/.hidden", "/wf/.hidden.kwav");
  CheckPath("/wf", "/music/.hidden.flac", "/wf/.hidden.kwav");

  CheckPath("/wf/", "/music/song.flac", "/wf/song.kwav");
  CheckPath("", "song.flac", "song.kwav");
}

}  // namespace

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 22;

int main() {
  TestGridStaysAnchoredAtOrigin();
  TestTruncationDropsLateBeatsNotEarlyOnes();
  TestBusyOnsetsGetOneBeatPerPeriod();
  TestSidecarPath();

  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "beat_tracker_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures == 0) {
    std::printf("beat_tracker_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "beat_tracker_verify: %d failure(s)\n", g_failures);
  return 1;
}
