// Downbeat labelling coverage for kb_analyze_song (D2/#13): output shape and the
// ABI truncation drop path. The df-unit conversion and decimation feed are NOT
// validated here — see the note on RunDownbeatTests.
#include "kitbag_api.h"

#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

#include "analysis/beat_tracker.h"
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
// conversion off by any scale factor still passes every check here. NOTHING in
// this file validates that beats landed on the right audio; D4/#15's known-tempo
// fixture is that validation, and it is load-bearing, not optional.
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

// Asserts the truncated run dropped the last bar-one and kept no dangling index.
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
  TestDownbeatTruncation(dir);
}

}  // namespace analyze_test
