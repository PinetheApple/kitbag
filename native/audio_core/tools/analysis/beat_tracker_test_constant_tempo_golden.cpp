#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

#include "analysis/beat_tracker.h"
#include "check.h"
#include "constant_tempo_fixtures.h"

namespace beat_tracker_test {

namespace {

using kitbag_test::Check;

constexpr ClickSpec kCleanClick = {
    .first_sec = 0.37,
    .bpm = 120.5,
    .count = 160,
    .jitter_sec = 0.0,
};
constexpr ClickSpec kStrayClick = {
    .first_sec = 0.21,
    .bpm = 120.0,
    .count = 200,
    .jitter_sec = 0.004,
};
constexpr ClickSpec kDoubleClick = {
    .first_sec = 0.15,
    .bpm = 120.0,
    .count = 200,
    .jitter_sec = 0.003,
};
constexpr ExtraBeats kStrays = {
    .first = 25,
    .end = 200,
    .every = 50,
    .offset_periods = 0.3,
};
constexpr ExtraBeats kDoubleTime = {
    .first = 80,
    .end = 100,
    .every = 1,
    .offset_periods = 0.5,
};
constexpr int32_t kCleanFirstDownbeat = 1;

enum class Fixture { kClean, kJittered, kRamp, kStray, kDouble };

Grid OnClick(std::vector<float> beats, int32_t first_downbeat) {
  std::vector<int32_t> downbeats =
      EveryNth(kCommonBeatsPerBar, first_downbeat, beats.size());
  return {std::move(beats), std::move(downbeats)};
}

Grid WithExtraBeats(const ClickSpec& spec, const ExtraBeats& extra) {
  const std::vector<float> click = Click(spec);
  std::vector<float> beats = WithExtras(click, spec.bpm, extra);
  std::vector<int32_t> downbeats = ClickDownbeats(beats, click);
  return {std::move(beats), std::move(downbeats)};
}

Grid Build(Fixture fixture) {
  switch (fixture) {
    case Fixture::kClean:
      return OnClick(Click(kCleanClick), kCleanFirstDownbeat);
    case Fixture::kJittered:
      return OnClick(Click(kJitteredClick), kJitteredFirstDownbeat);
    case Fixture::kRamp:
      return OnClick(DraggingOutro(), 0);
    case Fixture::kStray:
      return WithExtraBeats(kStrayClick, kStrays);
    case Fixture::kDouble:
      return WithExtraBeats(kDoubleClick, kDoubleTime);
  }
  return {};
}

// StemDeck's fit_constant_tempo on these grids (bpm = 60 / its unrounded
// slope), and BeatGridBpm as main computed it, which must not move.
struct Golden {
  const char* name;
  Fixture fixture;
  double bpm;
  double anchor;
  int32_t beats_per_bar;
  float beat_grid_bpm;
};

constexpr Golden kGoldens[] = {
    {"clean", Fixture::kClean, 120.50000033679991, 0.867925, 4, 0x1.e2p+6f},
    {"jittered",
     Fixture::kJittered,
     123.70023888872504,
     1.283635,
     4,
     0x1.eecd0cp+6f},
    {"ramp", Fixture::kRamp, 120.0, 0.0, 4, 0x1.ep+6f},
    {"stray beats",
     Fixture::kStray,
     119.99990059568368,
     0.209939,
     4,
     0x1.e9a414p+6f},
    {"double-time stretch",
     Fixture::kDouble,
     119.99992370080463,
     0.149953,
     4,
     0x1.107df6p+7f},
};

constexpr double kParitySec = 0.001;

void CheckGolden(const Golden& golden) {
  const Grid grid = Build(golden.fixture);
  const Fit fit = RunFit(grid.beats, grid.downbeats);
  const double error = GridErrorAt(
      grid.beats.back(),
      fit.bpm,
      fit.anchor,
      golden.bpm,
      golden.anchor
  );
  const std::string name = golden.name;
  Check(
      fit.status == KB_OK && error <= kParitySec,
      ("golden: " + name +
       " stays within 1 ms of StemDeck's grid at its last beat")
          .c_str()
  );
  Check(
      std::fabs(fit.anchor - golden.anchor) <= kParitySec &&
          fit.beats_per_bar == golden.beats_per_bar,
      ("golden: " + name + " anchors and meters as StemDeck does").c_str()
  );
  Check(
      kitbag::BeatGridBpm(grid.beats) == golden.beat_grid_bpm,
      ("golden: BeatGridBpm on " + name + " is unchanged from main").c_str()
  );
}

}  // namespace

void RunGoldenTests() {
  for (const Golden& golden : kGoldens) CheckGolden(golden);
}

}  // namespace beat_tracker_test
