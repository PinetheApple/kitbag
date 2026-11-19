#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "check.h"
#include "constant_tempo_fixtures.h"

namespace beat_tracker_test {

namespace {

using kitbag_test::Check;

std::vector<int32_t>
NumbersAt(const std::vector<int32_t>& gaps, int32_t first) {
  std::vector<int32_t> out{first};
  for (const int32_t gap : gaps) out.push_back(out.back() + gap);
  return out;
}

std::vector<int32_t> Repeat(int32_t gap, int count) {
  return std::vector<int32_t>(count, gap);
}

constexpr ClickSpec kJittered = {0.3137, 123.7, 240, 0.012};
constexpr int32_t kJitteredFirstDownbeat = 2;
constexpr double kGridErrorSec = 0.001;
constexpr double kAnchorToleranceSec = 0.004;

void TestJitteredClick() {
  const std::vector<float> beats = Click(kJittered);
  const Fit fit =
      RunFit(beats, EveryNth(kCommonBar, kJitteredFirstDownbeat, beats.size()));
  const double anchor =
      kJittered.first_sec + kJitteredFirstDownbeat * Period(kJittered.bpm);
  Check(fit.status == KB_OK, "fit: a jittered click fits");
  Check(
      GridErrorAt(beats.back(), fit.bpm, fit.anchor, kJittered.bpm, anchor) <=
          kGridErrorSec,
      "fit: a jittered click's grid is within 1 ms of the true one at its last "
      "beat"
  );
  Check(
      std::fabs(fit.anchor - anchor) < kAnchorToleranceSec,
      "fit: the anchor is the bar line on the first downbeat, within 4 ms"
  );
  Check(fit.beats_per_bar == kCommonBar, "fit: bars of four read 4");
}

constexpr double kEarlyBpm = 97.0;
constexpr int kEarlyCount = 64;
constexpr double kEarlySec = 0.006;
constexpr double kExactToleranceSec = 1e-4;

std::vector<float> EarlyLineBeats() {
  std::vector<float> beats{0.0f};
  for (int k = 1; k < kEarlyCount; ++k) {
    beats.push_back(static_cast<float>(k * Period(kEarlyBpm) - kEarlySec));
  }
  return beats;
}

void TestNegativeInterceptMovesABar() {
  const std::vector<float> beats = EarlyLineBeats();
  const double want = kCommonBar * Period(kEarlyBpm) - kEarlySec;
  const Fit barred = RunFit(beats, EveryNth(kCommonBar, 0, beats.size()));
  Check(
      barred.status == KB_OK && barred.anchor >= 0.0,
      "fit: a line through a negative time still anchors at or after 0"
  );
  Check(
      std::fabs(barred.anchor - want) < kExactToleranceSec,
      "fit: a negative anchor moves forward one whole bar, not one beat"
  );
  const Fit loose = RunFit(beats, {});
  Check(
      std::fabs(loose.anchor - want) < kExactToleranceSec,
      "fit: with no downbeats a negative anchor still moves a whole bar"
  );
}

constexpr ClickSpec kLoose = {0.2113, 141.3, 100, 0.008};

void TestNoDownbeats() {
  const Fit fit = RunFit(Click(kLoose), {});
  Check(
      fit.status == KB_OK && fit.beats_per_bar == kCommonBar,
      "fit: no downbeats falls back to 4 beats per bar"
  );
  Check(
      std::fabs(fit.anchor - kLoose.first_sec) < kAnchorToleranceSec,
      "fit: no downbeats anchors on the first beat's line"
  );
}

constexpr ClickSpec kMeterClick = {0.4271, 88.4, 120, 0.0};
constexpr int32_t kTriple = 3;
constexpr int32_t kSeven = 7;
constexpr int32_t kPickupGap = 4;
constexpr int32_t kMissedBarGap = 6;
constexpr int kMeterBars = 12;

void TestMeters() {
  const std::vector<float> beats = Click(kMeterClick);
  std::vector<int32_t> triple = Repeat(kTriple, kMeterBars);
  triple[2] = kMissedBarGap;
  Check(
      RunFit(beats, NumbersAt(triple, 0)).beats_per_bar == kTriple,
      "fit: 3/4 downbeats with a missed bar read 3, the modal gap"
  );
  std::vector<int32_t> seven = Repeat(kSeven, kMeterBars);
  seven[0] = kPickupGap;
  const Fit odd = RunFit(beats, NumbersAt(seven, 0));
  Check(odd.beats_per_bar == kSeven, "fit: 7/8 after a pickup reads 7");
  Check(
      std::fabs(
          odd.anchor -
          (kMeterClick.first_sec + kPickupGap * Period(kMeterClick.bpm))
      ) < kExactToleranceSec,
      "fit: bar lines follow the modal downbeat phase, not the pickup's"
  );
  const std::vector<int32_t> tied = {kTriple, kPickupGap, kTriple, kPickupGap};
  Check(
      RunFit(beats, NumbersAt(tied, 0)).beats_per_bar == kTriple,
      "fit: a tie between gaps goes to the one seen first"
  );
}

constexpr double kSteadyBpm = 120.0;
constexpr double kCentreTolerance = 0.5;

void TestDriftKeepsTheCentre() {
  const Fit fit = RunFit(DraggingOutro(), {});
  Check(
      fit.status == KB_OK && std::fabs(fit.bpm - kSteadyBpm) < kCentreTolerance,
      "fit: a dragging outro leaves the Theil-Sen centre at the steady 120"
  );
}

void TestLongestGrid() {
  const ClickSpec spec =
      {0.1, kSteadyBpm, KB_MAX_GRID_BEATS, kJittered.jitter_sec};
  const std::vector<float> beats = Click(spec);
  const Fit fit = RunFit(beats, {});
  Check(
      fit.status == KB_OK && GridErrorAt(
                                 beats.back(),
                                 fit.bpm,
                                 fit.anchor,
                                 spec.bpm,
                                 spec.first_sec
                             ) <= kGridErrorSec,
      "fit: a KB_MAX_GRID_BEATS click's grid is within 1 ms at its last beat"
  );
}

}  // namespace

void RunConstantTempoTests() {
  TestJitteredClick();
  TestNegativeInterceptMovesABar();
  TestNoDownbeats();
  TestMeters();
  TestDriftKeepsTheCentre();
  TestLongestGrid();
}

}  // namespace beat_tracker_test
