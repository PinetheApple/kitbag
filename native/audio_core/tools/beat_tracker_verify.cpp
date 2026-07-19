// Regression checks for two silent-corruption bugs found in a comment audit:
//
//  1. TrackBeats backtracked into a fixed 2048-entry stack buffer, stopping
//     when it filled. Because the backtrack walks BACKWARD from the last beat,
//     a track with more beats than that returned a grid whose first entry sat
//     minutes into the song — the origin shifted, silently.
//  2. The .kwav sidecar path stripped extensions with arithmetic that only
//     worked for a 3-letter one, so song.flac became song.fla.kwav.
#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "beat_tracker.h"
#include "sidecar_path.h"

namespace {

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

void CheckPath(const char* dir, const char* song_path, const char* expected) {
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

void TestSidecarPath() {
  // The extension lengths are the point: -4 arithmetic passes .wav, appends to
  // .mp3, and eats a character of .flac.
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

int main() {
  TestGridStaysAnchoredAtOrigin();
  TestTruncationDropsLateBeatsNotEarlyOnes();
  TestSidecarPath();

  if (g_failures == 0) {
    std::printf("beat_tracker_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "beat_tracker_verify: %d failure(s)\n", g_failures);
  return 1;
}
