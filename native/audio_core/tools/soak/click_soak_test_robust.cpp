#include "soak_cli.h"
#include "soak_fixtures.h"

namespace soak_test {

namespace {

using click_soak::Report;

void TestNoise() {
  std::vector<float> mono = Synthesize(GridTimes(), 0.3, kRate);
  AddNoise(&mono, 0.03);
  const Report clean = Classify(mono, GridTimes());
  Check(
      clean.onsets_detected == kBeats,
      "noise: one onset per click, none from noise"
  );
  Check(
      clean.dropped == 0 && clean.doubled == 0 && clean.jittered == 0,
      "noise: no faults"
  );
  Check(clean.deviation_max_abs_ms < 0.2, "noise: onsets within 0.2 ms");

  std::vector<double> clicks = GridTimes();
  clicks[29] += 0.003;
  std::vector<float> jittered = Synthesize(clicks, 0.3, kRate);
  AddNoise(&jittered, 0.03);
  Check(
      Classify(jittered, GridTimes()).jittered == 1,
      "noise: 3 ms jitter still caught"
  );
}

// A recorder whose clock runs 100 ppm fast stretches every interval; the
// offset drifts 2 ms over the train, which is not jitter.
void TestClockDrift() {
  std::vector<double> clicks;
  for (size_t i = 0; i < kBeats; ++i) {
    clicks.push_back(
        kFirstBeatSec + static_cast<double>(i) * Interval() * 1.0001
    );
  }
  const Report report = Classify(Synthesize(clicks, 1.0, kRate), GridTimes());
  Check(report.jittered == 0, "drift: clock drift is not jitter");
  Check(
      report.dropped == 0 && report.doubled == 0,
      "drift: nothing dropped or doubled"
  );
  Check(
      Near(report.offset_max_abs_ms, 2.0, 0.05),
      "drift: offset grows to 2 ms"
  );
  Check(
      click_soak::ThresholdFailures(report).empty(),
      "drift: 100 ppm passes gated"
  );
}

std::vector<double> AcceleratingGrid() {
  std::vector<double> grid;
  double t = kFirstBeatSec;
  double interval = 0.62;
  for (size_t i = 0; i < kBeats; ++i) {
    grid.push_back(t);
    t += interval;
    interval -= 0.0005;
  }
  return grid;
}

void TestNonConstantGrid() {
  const std::vector<double> grid = AcceleratingGrid();
  const std::vector<float> mono = Synthesize(grid, 1.0, kRate);
  const Report followed = Classify(mono, grid);
  Check(followed.clicks_analysed == kBeats, "tempo map: every beat matched");
  Check(
      followed.jittered == 0 && followed.dropped == 0,
      "tempo map: no faults"
  );
  Check(
      followed.error_max_abs_ms <= kTightMs,
      "tempo map: interval error within 1.5 samples"
  );

  std::vector<double> constant;
  const double mean = (grid.back() - grid.front()) / (kBeats - 1);
  for (size_t i = 0; i < kBeats; ++i) {
    constant.push_back(grid.front() + static_cast<double>(i) * mean);
  }
  const Report flat = Classify(mono, constant);
  Check(
      flat.error_max_abs_ms > 5.0,
      "tempo map: a constant grid misjudges the same clicks"
  );
}

// Most of a device recording can be room noise: the click level must come
// from windows above the noise gate, not from the median of the whole file.
void TestNoiseLeadIn() {
  std::vector<double> grid = GridTimes();
  for (double& t : grid) t += 60.0;
  std::vector<float> mono = Synthesize(grid, 0.3, kRate);
  AddNoise(&mono, 0.03);
  click_soak::DetectionLevels levels;
  const auto onsets =
      click_soak::DetectOnsets(mono, kRate, Interval(), &levels);
  Check(
      Near(levels.click_peak, 0.18, 0.03),
      "noise lead-in: click level, not noise"
  );
  const Report report = click_soak::ClassifyClicks(
      onsets,
      grid,
      static_cast<double>(mono.size()) / kRate
  );
  Check(
      report.onsets_detected == kBeats,
      "noise lead-in: no onsets from noise"
  );
  Check(report.dropped == 0 && report.doubled == 0, "noise lead-in: no faults");
}

}  // namespace

void RunRobustnessTests() {
  TestNoise();
  TestNoiseLeadIn();
  TestClockDrift();
  TestNonConstantGrid();
}

}  // namespace soak_test
