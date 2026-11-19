#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "analysis/beat_tracker.h"
#include "check.h"

namespace beat_tracker_test {

namespace {

using kitbag_test::Check;

constexpr double kSecondsPerMinute = 60.0;
constexpr float kSentinelBpm = 77.0f;
constexpr double kSentinelAnchor = 7.7;
constexpr int32_t kSentinelBar = 7;
constexpr int32_t kCommonBar = 4;

constexpr uint32_t kLcgMultiplier = 1664525u;
constexpr uint32_t kLcgIncrement = 1013904223u;
constexpr double kLcgRange = 4294967296.0;

struct Fit {
  kb_result status = KB_ERROR_INTERNAL;
  float bpm = kSentinelBpm;
  double anchor = kSentinelAnchor;
  int32_t beats_per_bar = kSentinelBar;
};

Fit RunFit(
    const std::vector<float>& beats,
    const std::vector<int32_t>& downbeats
) {
  Fit fit;
  fit.status = kb_fit_constant_tempo(
      beats.data(),
      static_cast<int32_t>(beats.size()),
      downbeats.empty() ? nullptr : downbeats.data(),
      static_cast<int32_t>(downbeats.size()),
      &fit.bpm,
      &fit.anchor,
      &fit.beats_per_bar
  );
  return fit;
}

bool ReadsZero(const Fit& fit) {
  return fit.bpm == 0.0f && fit.anchor == 0.0 && fit.beats_per_bar == 0;
}

double Period(double bpm) {
  return kSecondsPerMinute / bpm;
}

struct ClickSpec {
  double first_sec;
  double bpm;
  int count;
  double jitter_sec;
};

std::vector<float> Click(const ClickSpec& spec) {
  uint32_t state = 1;
  std::vector<float> beats;
  for (int k = 0; k < spec.count; ++k) {
    state = state * kLcgMultiplier + kLcgIncrement;
    const double unit = 2.0 * (state / kLcgRange) - 1.0;
    beats.push_back(
        static_cast<float>(
            spec.first_sec + k * Period(spec.bpm) + unit * spec.jitter_sec
        )
    );
  }
  return beats;
}

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
constexpr double kBpmTolerance = 0.05;
constexpr double kAnchorToleranceSec = 0.004;

void TestJitteredClick() {
  const std::vector<float> beats = Click(kJittered);
  const auto bars = static_cast<int>(kJittered.count / kCommonBar) - 1;
  const Fit fit = RunFit(
      beats,
      NumbersAt(Repeat(kCommonBar, bars), kJitteredFirstDownbeat)
  );
  const double anchor =
      kJittered.first_sec + kJitteredFirstDownbeat * Period(kJittered.bpm);
  Check(fit.status == KB_OK, "fit: a jittered click fits");
  Check(
      std::fabs(fit.bpm - kJittered.bpm) < kBpmTolerance,
      "fit: a jittered click recovers its bpm within 0.05"
  );
  Check(
      std::fabs(fit.anchor - anchor) < kAnchorToleranceSec,
      "fit: the anchor is the bar line on the first downbeat, within 4 ms"
  );
  Check(fit.beats_per_bar == kCommonBar, "fit: bars of four read 4");
  Check(
      fit.bpm == kitbag::BeatGridBpm(beats),
      "fit: the bpm is BeatGridBpm's, bit for bit"
  );
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
  const auto bars = static_cast<int>(kEarlyCount / kCommonBar) - 1;
  const double want = kCommonBar * Period(kEarlyBpm) - kEarlySec;
  const Fit barred = RunFit(beats, NumbersAt(Repeat(kCommonBar, bars), 0));
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

constexpr int kSteadyBeats = 120;
constexpr int kDragBeats = 40;
constexpr double kSteadySec = 0.5;
constexpr double kDragEndSec = 0.74;
constexpr double kSteadyBpm = 120.0;
constexpr double kCentreTolerance = 0.5;

void TestDriftKeepsTheCentre() {
  std::vector<float> beats{0.0f};
  for (int k = 1; k < kSteadyBeats + kDragBeats; ++k) {
    const double drag = std::max(0, k - kSteadyBeats) / double{kDragBeats};
    const double gap = kSteadySec + drag * (kDragEndSec - kSteadySec);
    beats.push_back(static_cast<float>(beats.back() + gap));
  }
  const Fit fit = RunFit(beats, {});
  Check(
      fit.status == KB_OK && std::fabs(fit.bpm - kSteadyBpm) < kCentreTolerance,
      "fit: a dragging outro leaves the Theil-Sen centre at the steady 120"
  );
}

void TestLongestGrid() {
  const std::vector<float> beats =
      Click({0.1, kSteadyBpm, KB_MAX_GRID_BEATS, kJittered.jitter_sec});
  const Fit fit = RunFit(beats, {});
  Check(
      fit.status == KB_OK && fit.bpm == kitbag::BeatGridBpm(beats),
      "fit: a KB_MAX_GRID_BEATS grid fits to BeatGridBpm's bpm"
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
