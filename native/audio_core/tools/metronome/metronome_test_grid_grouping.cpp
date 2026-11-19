#include <string>

#include "grid_click_fixture.h"
#include "zero_clock.h"

namespace metronome_test {
namespace {

using grid_click::Configure;
using grid_click::ExpectLevelString;
using grid_click::kBeatsSec;
using grid_click::kSevenBeatBars;
using grid_click::kThreeTwoTwo;
using grid_click::kTwoTwoThree;
using grid_levels::Midpoint;

constexpr int32_t kSixBeatMiddle[] = {1, 8, 14, 21};
constexpr double kClearAtSec = 3.4;
constexpr double kRingOutSec = 0.5;

std::vector<int64_t> EventFrames(bool halves) {
  std::vector<int64_t> frames;
  for (size_t i = 0; i < std::size(kBeatsSec); ++i) {
    frames.push_back(FramesFor(kBeatsSec[i]));
    if (halves && i + 1 < std::size(kBeatsSec)) {
      frames.push_back(FramesFor(Midpoint(kBeatsSec[i], kBeatsSec[i + 1])));
    }
  }
  return frames;
}

std::string WithHalves(const std::string& beats, char half) {
  std::string events;
  for (size_t i = 0; i < beats.size(); ++i) {
    events += beats[i];
    if (i + 1 < beats.size()) events += half;
  }
  return events;
}

struct LevelCase {
  const char* label;
  std::span<const int32_t> downbeats;
  std::span<const int32_t> grouping;
  int32_t rate;
  std::string want;
  int32_t subdivision = kitbag::Metronome::kMinSubdivision;
};

void ExpectLevels(const LevelCase& c) {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(c.subdivision);
  Configure(metronome, kBeatsSec, c.downbeats, c.grouping, c.rate);
  const bool halves = c.want.size() > std::size(kBeatsSec);
  const std::string got = grid_levels::Levels(
      grid_click::TakeAll(metronome, kBeatsSec),
      EventFrames(halves)
  );
  ExpectLevelString(got, c.want, c.label);
}

void TestGroupedLevels() {
  const LevelCase cases[] = {
      {"3+2+2 on every 7-beat bar",
       kSevenBeatBars,
       kThreeTwoTwo,
       KB_GRID_RATE_SINGLE,
       "nBnnGnGnBnnGnGnBnnGnGnBn"},
      {"2+2+3 on every 7-beat bar",
       kSevenBeatBars,
       kTwoTwoThree,
       KB_GRID_RATE_SINGLE,
       "nBnGnGnnBnGnGnnBnGnGnnBn"},
      {"a 6-beat bar falls back to its downbeat",
       kSixBeatMiddle,
       kThreeTwoTwo,
       KB_GRID_RATE_SINGLE,
       "nBnnGnGnBnnnnnBnnGnGnBnn"},
  };
  for (const LevelCase& c : cases) ExpectLevels(c);
}

void TestDoubleAndHalfLevels() {
  const LevelCase cases[] = {
      {"x2 halves each measured interval, across the tempo change",
       kSevenBeatBars,
       kThreeTwoTwo,
       KB_GRID_RATE_DOUBLE,
       WithHalves("nBnnGnGnBnnGnGnBnnGnGnBn", grid_levels::kNormal)},
      {"x1/2 with 2+2+3 clicks 0, 2, 4, 6 of each bar",
       kSevenBeatBars,
       kTwoTwoThree,
       KB_GRID_RATE_HALF,
       "nB-G-G-nB-G-G-nB-G-G-nB-"},
      {"x1/2 with 3+2+2 restarts on every group start",
       kSevenBeatBars,
       kThreeTwoTwo,
       KB_GRID_RATE_HALF,
       "nB-nG-G-B-nG-G-B-nG-G-B-"},
  };
  for (const LevelCase& c : cases) ExpectLevels(c);
}

void TestHalfWithoutGrouping() {
  const LevelCase cases[] = {
      {"x1/2 restarts on each downbeat of an odd bar",
       kSevenBeatBars,
       {},
       KB_GRID_RATE_HALF,
       "nB-n-n-nB-n-n-nB-n-n-nB-"},
      {"x1/2 without downbeats counts from the first beat",
       {},
       {},
       KB_GRID_RATE_HALF,
       "n-n-n-n-n-n-n-n-n-n-n-n-"},
      {"x1/2 subdivisions divide the span to the next click",
       kSevenBeatBars,
       {},
       KB_GRID_RATE_HALF,
       "nt" + std::string("B-t-n-t-n-t-nt") + "B-t-n-t-n-t-nt" +
           "B-t-n-t-n-t-nt" + "B--",
       kitbag::Metronome::kMinSubdivision + 1},
  };
  for (const LevelCase& c : cases) ExpectLevels(c);
}

std::vector<float> RenderClearing(bool set_first) {
  kitbag::Metronome metronome;
  Configure(
      metronome,
      kBeatsSec,
      kSevenBeatBars,
      set_first ? std::span<const int32_t>(kThreeTwoTwo)
                : std::span<const int32_t>(),
      set_first ? KB_GRID_RATE_DOUBLE : KB_GRID_RATE_SINGLE
  );
  const int64_t clear_at =
      grid_levels::BlockStart(FramesFor(kClearAtSec), kBlockFrames);
  return RenderLeft(
      metronome,
      FramesFor(kBeatsSec[std::size(kBeatsSec) - 1] + grid_click::kTailSec),
      [&](int64_t rendered) {
        if (rendered != clear_at) return;
        metronome.SetGridGrouping({});
        metronome.SetGridRate(KB_GRID_RATE_SINGLE);
      }
  );
}

void TestClearRestoresOutput() {
  const std::vector<float> cleared = RenderClearing(true);
  const std::vector<float> plain = RenderClearing(false);
  const int64_t from = FramesFor(kClearAtSec + kRingOutSec);
  const auto count = static_cast<int64_t>(plain.size()) - from;
  CheckCase(
      cleared.size() == plain.size() &&
          SameSamples(cleared, from, plain, from, count),
      "grid grouping: clearing grouping and rate restores the plain output",
      "samples differ after the clear"
  );
  CheckCase(
      !SameSamples(cleared, 0, plain, 0, from),
      "grid grouping: the cleared run differed before the clear",
      "identical before the clear, so the comparison proves nothing"
  );
}

void TestSetGridResets() {
  kitbag::Metronome metronome;
  Configure(
      metronome,
      kBeatsSec,
      kSevenBeatBars,
      kThreeTwoTwo,
      KB_GRID_RATE_DOUBLE
  );
  metronome.SetGrid(
      grid_click::Grid(kBeatsSec, kSevenBeatBars),
      kitbag_test::kZeroClock,
      true
  );
  const std::string got = grid_levels::Levels(
      grid_click::TakeAll(metronome, kBeatsSec),
      EventFrames(true)
  );
  ExpectLevelString(
      got,
      WithHalves("nBnnnnnnBnnnnnnBnnnnnnBn", grid_levels::kSilent),
      "set_grid resets the grouping and the rate"
  );
}

}  // namespace

void RunGridGroupingTests() {
  TestGroupedLevels();
  TestDoubleAndHalfLevels();
  TestHalfWithoutGrouping();
  TestClearRestoresOutput();
  TestSetGridResets();
  grid_click::RunGridRateSwitchTests();
}

}  // namespace metronome_test
