#include <cmath>
#include <iterator>
#include <string>

#include "grid_click_levels.h"
#include "metronome/grid_bars.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

// Uneven, and from beat 12 the tempo jumps, so a midpoint at a fixed tempo
// lands outside the search window around the true one.
constexpr double kBeatsSec[] = {0.1,  0.61, 1.09, 1.62, 2.11,  2.6,
                                3.13, 3.61, 4.12, 4.6,  5.11,  5.63,
                                6.1,  6.49, 6.91, 7.3,  7.71,  8.13,
                                8.52, 8.93, 9.31, 9.72, 10.14, 10.53};
constexpr size_t kBeatCount = std::size(kBeatsSec);
constexpr double kTailSec = 0.5;
constexpr int32_t kSevenBeatBars[] = {1, 8, 15, 22};
constexpr int32_t kSixBeatMiddle[] = {1, 8, 14, 21};
constexpr int32_t kThreeTwoTwo[] = {3, 2, 2};
constexpr int32_t kTwoTwoThree[] = {2, 2, 3};
constexpr double kClearAtSec = 3.4;
constexpr double kRingOutSec = 0.5;

std::unique_ptr<kitbag::BeatGrid> Grid(std::span<const int32_t> downbeats) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec.assign(std::begin(kBeatsSec), std::end(kBeatsSec));
  grid->bars = kitbag::GridBars(downbeats, kBeatCount);
  return grid;
}

void Configure(
    kitbag::Metronome& metronome,
    std::span<const int32_t> downbeats,
    std::span<const int32_t> grouping,
    int32_t rate
) {
  metronome.SetSounds(kBeepSound, kBeepSound);
  metronome.SetGridGrouping(grouping);
  metronome.SetGridRate(rate);
  metronome.SetGrid(Grid(downbeats), 0, true);
  metronome.Start();
}

std::vector<int64_t> EventFrames(bool halves) {
  std::vector<int64_t> frames;
  for (size_t i = 0; i < kBeatCount; ++i) {
    frames.push_back(FramesFor(kBeatsSec[i]));
    if (halves && i + 1 < kBeatCount) {
      frames.push_back(FramesFor((kBeatsSec[i] + kBeatsSec[i + 1]) / 2.0));
    }
  }
  return frames;
}

std::vector<float> Take(kitbag::Metronome& metronome) {
  return RenderLeft(metronome, FramesFor(kBeatsSec[kBeatCount - 1] + kTailSec));
}

std::string WithHalves(const std::string& beats) {
  std::string events;
  for (size_t i = 0; i < beats.size(); ++i) {
    events += beats[i];
    if (i + 1 < beats.size()) events += grid_levels::kNormal;
  }
  return events;
}

struct LevelCase {
  const char* label;
  std::span<const int32_t> downbeats;
  std::span<const int32_t> grouping;
  int32_t rate;
  std::string want;
};

void ExpectLevels(const LevelCase& c) {
  kitbag::Metronome metronome;
  Configure(metronome, c.downbeats, c.grouping, c.rate);
  const std::string got = grid_levels::Levels(
      Take(metronome),
      EventFrames(c.rate == KB_GRID_RATE_DOUBLE)
  );
  const std::string detail = "got " + got + ", expected " + c.want;
  CheckCase(
      got == c.want,
      std::string("grid grouping: ") + c.label,
      detail.c_str()
  );
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

void TestRateLevels() {
  const LevelCase cases[] = {
      {"x2 halves each measured interval, across the tempo change",
       kSevenBeatBars,
       kThreeTwoTwo,
       KB_GRID_RATE_DOUBLE,
       WithHalves("nBnnGnGnBnnGnGnBnnGnGnBn")},
      {"x1/2 restarts on each downbeat of an odd bar",
       kSevenBeatBars,
       kTwoTwoThree,
       KB_GRID_RATE_HALF,
       "nB-G-G-nB-G-G-nB-G-G-nB-"},
      {"x1/2 without downbeats counts from the first beat",
       {},
       {},
       KB_GRID_RATE_HALF,
       "n-n-n-n-n-n-n-n-n-n-n-n-"},
  };
  for (const LevelCase& c : cases) ExpectLevels(c);
}

std::vector<float> RenderClearing(bool set_first) {
  kitbag::Metronome metronome;
  Configure(
      metronome,
      kSevenBeatBars,
      set_first ? std::span<const int32_t>(kThreeTwoTwo)
                : std::span<const int32_t>(),
      set_first ? KB_GRID_RATE_DOUBLE : KB_GRID_RATE_SINGLE
  );
  const int64_t clear_at = FramesFor(kClearAtSec);
  return RenderLeft(
      metronome,
      FramesFor(kBeatsSec[kBeatCount - 1] + kTailSec),
      [&](int64_t rendered) {
        if (rendered != clear_at - clear_at % kBlockFrames) return;
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

// Switched to x2 just after a midpoint passed: that midpoint must not sound late.
void TestRateSwitchSkipsPassedHalf() {
  kitbag::Metronome metronome;
  Configure(metronome, kSevenBeatBars, {}, KB_GRID_RATE_SINGLE);
  const double half = (kBeatsSec[2] + kBeatsSec[3]) / 2.0;
  const int64_t switch_at = FramesFor(half) + 2 * kBlockFrames;
  const std::vector<float> left =
      RenderLeft(metronome, FramesFor(kBeatsSec[5]), [&](int64_t rendered) {
        if (rendered == switch_at - switch_at % kBlockFrames) {
          metronome.SetGridRate(KB_GRID_RATE_DOUBLE);
        }
      });
  const std::vector<int64_t> frames = {
      switch_at - switch_at % kBlockFrames,
      FramesFor(kBeatsSec[3]),
      FramesFor((kBeatsSec[3] + kBeatsSec[4]) / 2.0)
  };
  const std::string got = grid_levels::Levels(left, frames);
  const std::string detail = "got " + got + ", expected -nn";
  CheckCase(
      got == "-nn",
      "grid grouping: x2 set mid-beat skips a passed half",
      detail.c_str()
  );
}

}  // namespace

void RunGridGroupingTests() {
  TestGroupedLevels();
  TestRateLevels();
  TestClearRestoresOutput();
  TestRateSwitchSkipsPassedHalf();
}

}  // namespace metronome_test
