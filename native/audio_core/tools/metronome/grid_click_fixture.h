#ifndef KITBAG_TOOLS_METRONOME_GRID_CLICK_FIXTURE_H
#define KITBAG_TOOLS_METRONOME_GRID_CLICK_FIXTURE_H

#include <iterator>
#include <memory>
#include <span>
#include <string>
#include <vector>

#include "grid_click_levels.h"
#include "metronome/grid_bars.h"
#include "metronome_test_audio.h"
#include "zero_clock.h"

namespace metronome_test::grid_click {

// Uneven, and from beat 12 the tempo jumps, so a midpoint at a fixed tempo
// lands outside the search window around the true one.
constexpr double kBeatsSec[] = {0.1,  0.61, 1.09, 1.62, 2.11,  2.6,
                                3.13, 3.61, 4.12, 4.6,  5.11,  5.63,
                                6.1,  6.49, 6.91, 7.3,  7.71,  8.13,
                                8.52, 8.93, 9.31, 9.72, 10.14, 10.53};
// Wide enough that a click a quarter beat back has rung out of the search.
constexpr double kSlowBeatsSec[] = {0.1, 1.3, 2.53, 3.71, 4.9};
constexpr double kTailSec = 0.5;
constexpr int32_t kSevenBeatBars[] = {1, 8, 15, 22};
constexpr int32_t kThreeTwoTwo[] = {3, 2, 2};
constexpr int32_t kTwoTwoThree[] = {2, 2, 3};

inline std::unique_ptr<kitbag::BeatGrid>
Grid(std::span<const double> beats, std::span<const int32_t> downbeats) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec.assign(beats.begin(), beats.end());
  grid->bars = kitbag::GridBars(downbeats, beats.size());
  return grid;
}

inline void Configure(
    kitbag::Metronome& metronome,
    std::span<const double> beats,
    std::span<const int32_t> downbeats,
    std::span<const int32_t> grouping,
    int32_t rate
) {
  metronome.SetSounds(kBeepSound, kBeepSound);
  metronome.SetGrid(Grid(beats, downbeats), kitbag_test::kZeroClock, true);
  metronome.SetGridGrouping(grouping);
  metronome.SetGridRate(rate);
  metronome.Start();
}

inline int64_t AtBeats(std::span<const double> beats, double at) {
  const auto whole = static_cast<size_t>(at);
  const double into = at - static_cast<double>(whole);
  return FramesFor(beats[whole] + into * (beats[whole + 1] - beats[whole]));
}

inline std::vector<float>
TakeAll(kitbag::Metronome& metronome, std::span<const double> beats) {
  return RenderLeft(metronome, FramesFor(beats.back() + kTailSec));
}

inline void ExpectLevelString(
    const std::string& got,
    const std::string& want,
    const std::string& label
) {
  const std::string detail = "got " + got + ", expected " + want;
  CheckCase(got == want, "grid grouping: " + label, detail.c_str());
}

void RunGridRateSwitchTests();

}  // namespace metronome_test::grid_click

#endif  // KITBAG_TOOLS_METRONOME_GRID_CLICK_FIXTURE_H
