#include "kitbag_api.h"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/downbeat.h"
#include "analysis/song_analysis.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"
#include "wav_fixture.h"

namespace analyze_test {

namespace {

using kitbag::BeatResult;

// The meter DetectBeatsPerBar (meter.h) picks for these 4/4 fixtures, typed
// independently so a change to that choice trips the spacing check.
constexpr int kBeatsPerBar = 4;

constexpr std::array<int, 3> kLockingPhases = {0, 2, 3};
constexpr int kAccentPhase = kLockingPhases.back();
// Measured for this beat period and these tones: the control lands on the click
// grid's own phase 1, so that phase cannot show the accent was load-bearing.
constexpr int kFeaturelessPhase = 1;
constexpr int kFixtureBeats = 28;
constexpr int kNonNegativeBias = kFixtureBeats;
// Lets the last tone fit. The tracker may place a beat in this silence, so a
// bar-one there is tolerated, not expected.
constexpr int kTailBeats = 1;

// Bar-ones must be an in-range, ascending, strict subset of the beats, spaced
// one bar apart. Split from TestDownbeats to stay within the function-size cap.
void CheckDownbeatShape(const std::vector<int>& db, int beats) {
  kitbag_test::Check(!db.empty(), "downbeat: at least one bar-one labelled");
  kitbag_test::Check(
      static_cast<int>(db.size()) < beats,
      "downbeat: bar-ones are a strict subset of beats, not every beat"
  );

  bool in_range = true;
  bool ascending = true;
  bool bar_spaced = true;
  for (size_t i = 0; i < db.size(); ++i) {
    if (db[i] < 0 || db[i] >= beats) in_range = false;
    if (i > 0 && db[i] <= db[i - 1]) ascending = false;
    if (i > 0 && db[i] - db[i - 1] != kBeatsPerBar) bar_spaced = false;
  }
  kitbag_test::Check(in_range, "downbeat: every index falls within the beats");
  kitbag_test::Check(ascending, "downbeat: indices strictly ascending");
  kitbag_test::Check(
      bar_spaced,
      "downbeat: consecutive bar-ones are one bar (4 beats) apart"
  );
}

// These checks pin only the OUTPUT SHAPE. They cannot fail on a wrong df-unit
// conversion or a broken decimation feed: DownBeat emits its indices with a
// structural `for i += timesig`, so ascending / in-range / strict-subset /
// one-bar-apart all hold no matter which audio the beats were mapped onto — a
// conversion off by any scale factor still passes every check here. That
// validation is TestKnownTempoBarOne below, not these shape checks.
void TestDownbeats() {
  const BeatResult result = AnalyzePcm(MakeClickTrack());
  CheckDownbeatShape(
      result.downbeat_indices,
      static_cast<int>(result.beat_times.size())
  );
}

float AccentedBarHz(int beat, int phase) {
  const int pos = beat - phase + kNonNegativeBias * kBeatsPerBar;
  return kBarPitchesHz[(pos / kBeatsPerBar) % kBarPitchesHz.size()];
}

std::vector<float> SilentFixture() {
  const int total = (kFixtureBeats + kTailBeats) * kBeatPeriodFrames;
  return std::vector<float>(static_cast<size_t>(total) * 2, 0.0f);
}

std::vector<float> MakeControlTrack() {
  std::vector<float> pcm = SilentFixture();
  for (int b = 0; b < kFixtureBeats; ++b) {
    AddToneBeat(pcm, b, kBarPitchesHz[0], kToneAmp);
  }
  return pcm;
}

std::vector<float> MakeAccentedTrack(int phase) {
  std::vector<float> pcm = SilentFixture();
  for (int b = 0; b < kFixtureBeats; ++b) {
    AddToneBeat(pcm, b, AccentedBarHz(b, phase), kToneAmp);
  }
  return pcm;
}

// Bar-one beat times from the click grid at `phase` — computed from the
// fixed grid, not from detection, so a wrong detected phase cannot move it.
std::vector<float> ExpectedBarOneTimes(int phase) {
  std::vector<float> times;
  for (int b = phase; b < kFixtureBeats; b += kBeatsPerBar) {
    times.push_back(
        static_cast<float>(
            static_cast<double>(b) * kBeatPeriodFrames / kSampleRate
        )
    );
  }
  return times;
}

bool AtMostTrailingExtra(const BeatResult& result, size_t expected) {
  const std::vector<int>& db = result.downbeat_indices;
  if (db.size() == expected) return true;
  if (db.size() != expected + 1) return false;
  const int idx = db.back();
  const double last_click_sec =
      static_cast<double>(kFixtureBeats - 1) * kBeatPeriodFrames / kSampleRate;
  return idx >= 0 && idx < static_cast<int>(result.beat_times.size()) &&
         result.beat_times[idx] > last_click_sec + kBarOneToleranceSec;
}

// Every detected bar-one must sit within tolerance of its expected accented beat,
// in order. Fails if the accent stops driving detection or a scaled df-unit
// conversion maps beats onto the wrong audio — either way the times miss by a beat.
void CheckBarOneTimes(
    const BeatResult& result,
    const std::vector<float>& expected
) {
  const bool counted = AtMostTrailingExtra(result, expected.size());
  kitbag_test::Check(
      counted,
      "known-tempo: one bar-one detected per accented bar"
  );
  bool aligned = counted;
  for (size_t k = 0; k < result.downbeat_indices.size() && k < expected.size();
       ++k) {
    const int idx = result.downbeat_indices[k];
    const bool in_range =
        idx >= 0 && idx < static_cast<int>(result.beat_times.size());
    if (!in_range ||
        std::fabs(result.beat_times[idx] - expected[k]) > kBarOneToleranceSec) {
      aligned = false;
    }
  }
  kitbag_test::Check(
      aligned,
      "known-tempo: each bar-one time matches its accented click within tol"
  );
}

// The placed accent, not the click grid, must drive the detected phase: the
// accented fixture locks onto its phase and the featureless control lands
// elsewhere. Equal phases here would mean the accent changed nothing.
void CheckAccentIsLoadBearing(
    const BeatResult& accented,
    const BeatResult& control,
    int phase
) {
  kitbag_test::Check(
      !accented.downbeat_indices.empty() && !control.downbeat_indices.empty(),
      "load-bearing: both fixtures label at least one bar-one"
  );
  if (accented.downbeat_indices.empty() || control.downbeat_indices.empty()) {
    return;
  }
  const int acc = accented.downbeat_indices[0] % kBeatsPerBar;
  const int ctl = control.downbeat_indices[0] % kBeatsPerBar;
  std::printf(
      "analyze_verify: known-tempo accent %d -> bar one %d, control %d\n",
      phase,
      acc,
      ctl
  );
  kitbag_test::Check(
      acc == phase,
      "load-bearing: accented bar-one locks onto the placed accent phase"
  );
  kitbag_test::Check(
      ctl == kFeaturelessPhase && ctl != acc,
      "load-bearing: featureless control detects a different phase"
  );
}

void TestKnownTempoBarOne() {
  const BeatResult control = AnalyzePcm(MakeControlTrack());
  for (const int phase : kLockingPhases) {
    const BeatResult accented = AnalyzePcm(MakeAccentedTrack(phase));
    CheckBarOneTimes(accented, ExpectedBarOneTimes(phase));
    CheckAccentIsLoadBearing(accented, control, phase);
  }
}

// Silent input: no onsets, so the tracker places no beats and the pipeline must
// still return KB_OK with an empty, non-dangling downbeat set.
void CheckSilentPipelineEmpty() {
  const std::vector<float> silent(
      static_cast<size_t>(kBeatPeriodFrames) * 2,
      0.0f
  );
  BeatResult result;
  const kb_result status = AnalyzeDecodedPcm(
      silent.data(),
      kBeatPeriodFrames,
      StereoInfo(kBeatPeriodFrames, 2),
      "x",
      nullptr,
      &result
  );
  kitbag_test::Check(status == KB_OK, "degraded: silent input still KB_OK");
  kitbag_test::Check(
      result.downbeat_indices.empty(),
      "degraded: no bar-ones labelled, no dangling index"
  );
}

// Empty-result path. Synthesising a downbeat on every kBeatsPerBar-th beat when
// none are detected is the §11/Phase-2 TS consumer's job (D3 ruling, #14), not
// native — native only returns an empty label set gracefully.
void TestDegradedDownbeatPath() {
  CheckSilentPipelineEmpty();
  const std::vector<float> mono(kBeatPeriodFrames, kClickAmp);
  const std::vector<float> one_beat = {0.0f};
  const std::vector<int> db = analyze_test::FindDownbeats(
      mono.data(),
      kBeatPeriodFrames,
      static_cast<int>(kSampleRate),
      one_beat,
      kBeatsPerBar
  );
  kitbag_test::Check(
      db.empty(),
      "degraded: <2 beats hits the guard and yields no downbeats"
  );
}

void CheckTruncatedCopy(const AbiAnalysis& full, const AbiAnalysis& cut) {
  kitbag_test::Check(
      cut.beat_count == full.downbeats[full.downbeat_count - 1],
      "truncation: beat buffer filled to the smaller cap"
  );
  kitbag_test::Check(
      cut.downbeat_count < full.downbeat_count,
      "truncation: at least one bar-one dropped"
  );
  bool bounded = true;
  for (int i = 0; i < cut.downbeat_count; ++i) {
    if (cut.downbeats[i] >= cut.beat_count) bounded = false;
  }
  kitbag_test::Check(
      bounded,
      "truncation: no bar-one index dangles past beat_count"
  );
}

// Witnesses CopyDownbeats's drop path: a bar-one referencing a beat past the
// truncated beat buffer must not be written out. A full-cap run learns the
// layout, then a cap set to the last bar-one's index forces that bar-one out.
void TestDownbeatTruncation(const std::filesystem::path& dir) {
  const std::vector<float> pcm = MakeClickTrack();
  const std::string wav = (dir / "analyze_clicks.wav").string();
  kitbag_test::Check(
      media_test::WriteFloatWav(wav, pcm, 2, kSampleRate),
      "truncation: click fixture wav written"
  );

  AbiAnalysis full;
  AnalyzeThroughAbi(wav, nullptr, kAbiCap, &full);
  kitbag_test::Check(
      full.downbeat_count >= 2,
      "truncation: full run finds >= 2 bar-ones to truncate"
  );

  AbiAnalysis cut;
  AnalyzeThroughAbi(
      wav,
      nullptr,
      full.downbeats[full.downbeat_count - 1],
      &cut
  );
  CheckTruncatedCopy(full, cut);
  std::filesystem::remove(wav);
}

}  // namespace

std::vector<float> MakeBarToneTrack(bool accented) {
  return accented ? MakeAccentedTrack(kAccentPhase) : MakeControlTrack();
}

void RunDownbeatTests(const std::filesystem::path& dir) {
  TestDownbeats();
  TestKnownTempoBarOne();
  TestDegradedDownbeatPath();
  TestDownbeatTruncation(dir);
}

}  // namespace analyze_test
