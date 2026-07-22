// Downbeat labelling coverage for kb_analyze_song. TestDownbeats /
// TestDownbeatTruncation (D2/#13) pin output shape and the ABI truncation drop
// path; TestKnownTempoBarOne (D4/#15) is the load-bearing check that bar-ones
// land on the RIGHT beats at a known tempo (validating the df-unit conversion +
// decimation feed); TestDegradedDownbeatPath pins the empty-result path.
#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <filesystem>
#include <numbers>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/downbeat.h"
#include "analysis/song_analysis.h"
#include "analyze_test_support.h"
#include "check.h"
#include "wav_fixture.h"

namespace analyze_test {

namespace {

using kitbag::AnalyzeDecodedPcm;
using kitbag::BeatResult;

// Mirrors downbeat.cpp's 4/4 fallback independently, so a change to that default
// without updating this expectation trips the spacing check.
constexpr int kBeatsPerBar = 4;

// The per-bar pitch steps at beat phase kAccentPhase. On this fixture the real
// averaging downmix reports bar-one at phase kBarOnePhase, distinct from the
// featureless default (phase 1), so a pass proves the spectral structure drove it.
constexpr int kAccentPhase = 2;
// Detected phase, pinned to the real pipeline (verified by running it): the
// averaging downmix yields 3; a summing downmix instead yields 2, the trap an
// earlier hand-rolled downmix fell into, so never derive this from kAccentPhase.
constexpr int kBarOnePhase = 3;
// Each beat carries a tone whose pitch is constant within a bar and steps at the
// bar boundary, so the ONE large spectral transition per bar lands on the
// downbeat. base + step * (bar % cycle); cycle 5 keeps adjacent bars distinct.
constexpr float kBarToneBaseHz = 200.0f;
constexpr float kBarToneStepHz = 90.0f;
constexpr int kBarToneCycle = 5;
constexpr float kBarToneAmp = 0.3f;
constexpr int kBarToneGuardFrames = 200;
// Above the ~0.02 s beat-tracker drift, far below the 0.45 s one-beat spacing a
// wrong phase or a scaled df-unit conversion would produce.
constexpr float kBarOneToleranceSec = 0.1f;

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
  const std::vector<float> pcm = MakeClickTrack();
  const uint64_t frames = pcm.size() / 2;
  BeatResult result;
  const kb_result status = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &result
  );
  kitbag_test::Check(
      status == KB_OK,
      "downbeat: click track analyses to KB_OK"
  );
  CheckDownbeatShape(
      result.downbeat_indices,
      static_cast<int>(result.beat_times.size())
  );
}

// Pitch for beat b's bar: constant within a bar, stepping at each bar boundary
// (beats where b % kBeatsPerBar == kAccentPhase). The kBeatCount bias keeps the
// bar index non-negative through floor division for the leading partial bar.
float BarToneHz(int b) {
  const int bar = (b - kAccentPhase + kBeatCount) / kBeatsPerBar;
  return kBarToneBaseHz +
         kBarToneStepHz * static_cast<float>(bar % kBarToneCycle);
}

// Beat-spanning tone at the bar pitch. A start-edge click is zeroed by the
// Hanning window DownBeat applies; a beat-spanning tone gives the frame a
// distinct spectrum, and equal within-bar pitches leave only the boundary large.
void AddBarTone(std::vector<float>& pcm, int b, int total) {
  const int start = b * kBeatPeriodFrames;
  const float hz = BarToneHz(b);
  const int width = kBeatPeriodFrames - kBarToneGuardFrames;
  for (int s = 0; s < width && start + s < total; ++s) {
    const float v = kBarToneAmp *
                    std::sin(
                        2.0f * std::numbers::pi_v<float> * hz *
                        static_cast<float>(s) / static_cast<float>(kSampleRate)
                    );
    pcm[static_cast<size_t>(start + s) * 2] += v;
    pcm[static_cast<size_t>(start + s) * 2 + 1] += v;
  }
}

// Narrow onset click, so the tracker locks a stable beat grid regardless of the
// sustained tone.
void AddClick(std::vector<float>& pcm, int b, int total) {
  const int start = b * kBeatPeriodFrames;
  for (int s = 0; s < kClickWidth && start + s < total; ++s) {
    pcm[static_cast<size_t>(start + s) * 2] += kClickAmp;
    pcm[static_cast<size_t>(start + s) * 2 + 1] += kClickAmp;
  }
}

// Click track whose per-bar pitch fixes the true downbeats at deterministic,
// known positions (bars begin at phase kAccentPhase).
std::vector<float> MakeAccentedClickTrack() {
  // +1 beat of tail padding so the last beat's tone fits inside the buffer.
  const int total = (kBeatCount + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  for (int b = 0; b < kBeatCount; ++b) {
    AddBarTone(pcm, b, total);
    AddClick(pcm, b, total);
  }
  return pcm;
}

// Bar-one beat times from the click grid at kBarOnePhase — computed from the
// fixed grid, not from detection, so a wrong detected phase cannot move it.
std::vector<float> ExpectedBarOneTimes() {
  std::vector<float> times;
  for (int b = kBarOnePhase; b < kBeatCount; b += kBeatsPerBar) {
    times.push_back(
        static_cast<float>(
            static_cast<double>(b) * kBeatPeriodFrames / kSampleRate
        )
    );
  }
  return times;
}

// Every detected bar-one must sit within tolerance of its expected phase-3 beat,
// in order. Fails if a scaled df-unit conversion maps beats onto wrong audio: the
// phase then reverts to the featureless default 1,5,9 and the times miss by a beat.
void CheckBarOneTimes(
    const BeatResult& result,
    const std::vector<float>& expected
) {
  kitbag_test::Check(
      result.downbeat_indices.size() == expected.size(),
      "known-tempo: one bar-one detected per accented bar"
  );
  bool aligned = result.downbeat_indices.size() == expected.size();
  for (size_t k = 0; k < result.downbeat_indices.size() && k < expected.size();
       ++k) {
    const int idx = result.downbeat_indices[k];
    if (idx < 0 || idx >= static_cast<int>(result.beat_times.size())) {
      aligned = false;
    } else if (
        std::fabs(result.beat_times[idx] - expected[k]) > kBarOneToleranceSec
    ) {
      aligned = false;
    }
  }
  kitbag_test::Check(
      aligned,
      "known-tempo: each bar-one time matches its accented click within tol"
  );
}

void TestKnownTempoBarOne() {
  const std::vector<float> pcm = MakeAccentedClickTrack();
  const uint64_t frames = pcm.size() / 2;
  BeatResult result;
  const kb_result status = AnalyzeDecodedPcm(
      pcm.data(),
      frames,
      StereoInfo(frames, 2),
      "x",
      nullptr,
      &result
  );
  kitbag_test::Check(
      status == KB_OK,
      "known-tempo: accented click track analyses to KB_OK"
  );
  CheckBarOneTimes(result, ExpectedBarOneTimes());
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
  const std::vector<int> db = kitbag::FindDownbeats(
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

void RunDownbeatTests(const std::filesystem::path& dir) {
  TestDownbeats();
  TestKnownTempoBarOne();
  TestDegradedDownbeatPath();
  TestDownbeatTruncation(dir);
}

}  // namespace analyze_test
