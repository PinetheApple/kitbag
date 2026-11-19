#include <string>
#include <vector>

#include "grid_click_fixture.h"

namespace metronome_test::grid_click {
namespace {

using grid_levels::BlockStart;

constexpr int32_t kTwoTicks = kitbag::Metronome::kMinSubdivision + 1;
constexpr int32_t kOffBeatTickAccent = int32_t{1} << 1;

std::vector<float> RenderSwitching(
    kitbag::Metronome& metronome,
    std::span<const double> beats,
    int64_t switch_at,
    void (*change)(kitbag::Metronome&)
) {
  return RenderLeft(
      metronome,
      FramesFor(beats.back() + kTailSec),
      [&](int64_t rendered) {
        if (rendered == switch_at) change(metronome);
      }
  );
}

void TestRateSwitchSkipsPassedHalf() {
  kitbag::Metronome metronome;
  Configure(metronome, kBeatsSec, kSevenBeatBars, {}, KB_GRID_RATE_SINGLE);
  const int64_t switch_at =
      BlockStart(AtBeats(kBeatsSec, 2.5) + 2 * kBlockFrames, kBlockFrames);
  const std::vector<float> left = RenderSwitching(
      metronome,
      kBeatsSec,
      switch_at,
      [](kitbag::Metronome& m) { m.SetGridRate(KB_GRID_RATE_DOUBLE); }
  );
  const std::string got = grid_levels::Levels(
      left,
      {switch_at, AtBeats(kBeatsSec, 3.0), AtBeats(kBeatsSec, 3.5)}
  );
  ExpectLevelString(got, "-nn", "x2 set mid-beat skips a passed half");
}

void TestSubdivisionSwitchUnderDouble() {
  kitbag::Metronome metronome;
  Configure(metronome, kSlowBeatsSec, {}, {}, KB_GRID_RATE_DOUBLE);
  const int64_t switch_at =
      BlockStart(AtBeats(kSlowBeatsSec, 1.68), kBlockFrames);
  const std::vector<float> left = RenderSwitching(
      metronome,
      kSlowBeatsSec,
      switch_at,
      [](kitbag::Metronome& m) { m.SetSubdivision(kTwoTicks); }
  );
  const std::string got = grid_levels::Levels(
      left,
      {AtBeats(kSlowBeatsSec, 1.5),
       switch_at,
       AtBeats(kSlowBeatsSec, 1.75),
       AtBeats(kSlowBeatsSec, 2.0)}
  );
  ExpectLevelString(
      got,
      "n-tn",
      "a subdivision change mid-beat under x2 neither drops nor flams"
  );
}

void TestDoubleKeepsSubdivisionAccents() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(kTwoTicks);
  metronome.SetSubdivisionAccents(kTwoTicks, kOffBeatTickAccent);
  Configure(metronome, kSlowBeatsSec, {}, {}, KB_GRID_RATE_DOUBLE);
  std::vector<int64_t> frames;
  std::string want;
  for (size_t beat = 0; beat + 1 < std::size(kSlowBeatsSec); ++beat) {
    for (const double quarter : {0.0, 0.25, 0.5, 0.75}) {
      frames.push_back(
          AtBeats(kSlowBeatsSec, static_cast<double>(beat) + quarter)
      );
    }
    want += "nGnG";
  }
  const std::string got =
      grid_levels::Levels(TakeAll(metronome, kSlowBeatsSec), frames);
  ExpectLevelString(
      got,
      want,
      "x2 with two ticks per half keeps the off-beat tick accent"
  );
}

}  // namespace

void RunGridRateSwitchTests() {
  TestRateSwitchSkipsPassedHalf();
  TestSubdivisionSwitchUnderDouble();
  TestDoubleKeepsSubdivisionAccents();
}

}  // namespace metronome_test::grid_click
