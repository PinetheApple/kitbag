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
#include "analysis/onset_envelope.h"
#include "analysis/sidecar_path.h"
#include "beat_spacing.h"
#include "metronome/metronome_internal.h"

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

constexpr int kSampleRate = 48000;
constexpr float kHopTime =
    static_cast<float>(kitbag::kOnsetHopSize) / kSampleRate;
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

using kitbag::metronome_detail::kSecondsPerMinute;

constexpr int kBusyBeats = 200;
constexpr float kBusyBaseline = 0.15f;
constexpr float kBusyOffbeat = 0.5f;
constexpr int kBusyMissable = 2;
constexpr float kSlowEdgeScale = 1.03f;
constexpr float kMidBpm = 120.0f;
constexpr float kFastEdgeScale = 0.975f;
constexpr float kBusyTempos[] = {
    kitbag::kMinTrackedBpm * kSlowEdgeScale,
    kMidBpm,
    kitbag::kMaxTrackedBpm * kFastEdgeScale,
};

float PeriodHops(float bpm) {
  return static_cast<float>(kSecondsPerMinute) / (bpm * kHopTime);
}

struct OnsetTrack {
  std::vector<float> onset;
  std::vector<float> beat_hops;
};

// `offbeat` sits where a half-period grid would put its extra beats.
OnsetTrack Onsets(const std::vector<float>& beat_hops, float offbeat) {
  const float tail = beat_hops.back() - beat_hops[beat_hops.size() - 2];
  OnsetTrack track{
      std::vector<float>(
          static_cast<size_t>(std::lround(beat_hops.back() + tail)),
          kBusyBaseline
      ),
      beat_hops
  };
  for (size_t i = 0; i < beat_hops.size(); ++i) {
    const float next =
        i + 1 < beat_hops.size() ? beat_hops[i + 1] : beat_hops[i] + tail;
    track.onset[static_cast<size_t>(std::lround(beat_hops[i]))] = 1.0f;
    const auto mid =
        static_cast<size_t>(std::lround((beat_hops[i] + next) / 2));
    if (offbeat > 0.0f) track.onset[mid] = offbeat;
  }
  return track;
}

template <typename BpmAt>
std::vector<float> BeatHops(int beats, BpmAt bpm_at) {
  std::vector<float> hops = {0.0f};
  for (int k = 1; k < beats; ++k) {
    hops.push_back(hops.back() + PeriodHops(bpm_at(k - 1)));
  }
  return hops;
}

void TestBusyOnsetsGetOneBeatPerPeriod() {
  for (const float bpm : kBusyTempos) {
    const float period = PeriodHops(bpm);
    const OnsetTrack track =
        Onsets(BeatHops(kBusyBeats, [bpm](int) { return bpm; }), kBusyOffbeat);
    const std::vector<float> beats =
        kitbag::BeatTracker().TrackBeats(track.onset, kHopTime, bpm);
    const double min_gap = analyze_test::MinGap(beats);
    std::printf(
        "beat_tracker_verify: busy %.1f BPM -> %zu beats of %d, min gap %.1f "
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
        min_gap >= analyze_test::kMinGapPeriods * period * kHopTime,
        "busy onsets: no gap well under a period"
    );
  }
}

constexpr int kTrackBeats = 200;
constexpr float kRampStartBpm = 120.0f;
constexpr float kRampEndBpm = 132.0f;
constexpr float kStepAfterBpm = 144.0f;
constexpr float kOnTimeHops = 3.0f;

int MissedBeats(const std::vector<float>& beats, const OnsetTrack& track) {
  int missed = 0;
  for (const float hop : track.beat_hops) {
    float nearest = INFINITY;
    for (const float t : beats) {
      nearest = std::fmin(nearest, std::fabs(t / kHopTime - hop));
    }
    if (nearest > kOnTimeHops) ++missed;
  }
  return missed;
}

kitbag::BeatResult
AnalyzeTempoTrack(const char* name, const OnsetTrack& track) {
  kitbag::BeatResult r =
      kitbag::BeatTracker().AnalyzeFlux(track.onset, kSampleRate);
  std::printf(
      "beat_tracker_verify: %s -> bpm %.2f, %zu beats of %zu, %d off the "
      "played beats, min gap %.1f hops\n",
      name,
      r.bpm,
      r.beat_times.size(),
      track.beat_hops.size(),
      MissedBeats(r.beat_times, track),
      analyze_test::MinGap(r.beat_times) / kHopTime
  );
  return r;
}

void TestRampIsFollowed() {
  const OnsetTrack track = Onsets(
      BeatHops(
          kTrackBeats,
          [](int k) {
            return kRampStartBpm + (kRampEndBpm - kRampStartBpm) *
                                       static_cast<float>(k) /
                                       (kTrackBeats - 1);
          }
      ),
      kBusyOffbeat
  );
  const kitbag::BeatResult r = AnalyzeTempoTrack("ramp 120->132 BPM", track);
  Check(
      std::abs(static_cast<int>(r.beat_times.size()) - kTrackBeats) <=
          kBusyMissable,
      "ramp: one beat per played beat across a 10% tempo ramp"
  );
  Check(
      MissedBeats(r.beat_times, track) == 0,
      "ramp: every played beat has a placed beat on it"
  );
}

// Recorded, not asserted: one global period cannot fit both halves of a jump.
void RecordTempoStep() {
  AnalyzeTempoTrack(
      "step 120->144 BPM",
      Onsets(
          BeatHops(
              kTrackBeats,
              [](int k) {
                return k < kTrackBeats / 2 ? kRampStartBpm : kStepAfterBpm;
              }
          ),
          kBusyOffbeat
      )
  );
}

constexpr float kBalladBpm = 80.0f;
constexpr float kSlowBpm = 62.0f;
constexpr float kFaintOffbeat = 0.2f;

bool NearBpm(float got, float want) {
  return std::fabs(got - want) < analyze_test::kBpmTolerance * want;
}

// Pinned, not a target: half-strength eighths fold to double time, which the
// user corrects with the tempo's ÷2.
void TestOctaveOverBaseline() {
  const kitbag::BeatResult eighths = AnalyzeTempoTrack(
      "80 BPM + half-strength eighths",
      Onsets(
          BeatHops(kTrackBeats, [](int) { return kBalladBpm; }),
          kBusyOffbeat
      )
  );
  Check(
      NearBpm(eighths.bpm, 2.0f * kBalladBpm),
      "octave: half-strength eighths still read as the eighth pulse (pinned)"
  );
  const kitbag::BeatResult faint = AnalyzeTempoTrack(
      "62 BPM, faint off-beats",
      Onsets(BeatHops(kTrackBeats, [](int) { return kSlowBpm; }), kFaintOffbeat)
  );
  Check(
      NearBpm(faint.bpm, kSlowBpm),
      "octave: a 62 BPM pulse with faint off-beats is not folded"
  );
}

struct BoundTempo {
  const char* name;
  float bpm;
};

constexpr BoundTempo kBoundTempos[] = {
    {"plain pulse at the slowest tracked BPM", kitbag::kMinTrackedBpm},
    {"plain pulse at the fastest tracked BPM", kitbag::kMaxTrackedBpm},
};

void TestBoundTemposResolve() {
  for (const BoundTempo& bound : kBoundTempos) {
    const float bpm = bound.bpm;
    const kitbag::BeatResult r = AnalyzeTempoTrack(
        bound.name,
        Onsets(BeatHops(kTrackBeats, [bpm](int) { return bpm; }), 0.0f)
    );
    Check(
        NearBpm(r.bpm, bpm) && !r.beat_times.empty(),
        "bounds: a pulse at a tracked-BPM bound reads as that tempo"
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
constexpr int kExpectedChecks = 28;

int main() {
  TestGridStaysAnchoredAtOrigin();
  TestTruncationDropsLateBeatsNotEarlyOnes();
  TestBusyOnsetsGetOneBeatPerPeriod();
  TestRampIsFollowed();
  RecordTempoStep();
  TestOctaveOverBaseline();
  TestBoundTemposResolve();
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
