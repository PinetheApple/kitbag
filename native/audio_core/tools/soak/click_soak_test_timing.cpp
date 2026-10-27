#include <algorithm>

#include "soak_cli.h"
#include "soak_fixtures.h"

namespace soak_test {

namespace {

using click_soak::Report;
using click_soak::ThresholdFailures;

// The recording runs just past the last click's slot.
Report
Judge(const std::vector<double>& onsets, const std::vector<double>& grid) {
  const double end = onsets.back() + 0.6 * (grid[1] - grid[0]);
  return click_soak::ClassifyClicks(onsets, grid, end);
}

Report Ungated(Report report) {
  report.offset_gated = false;
  return report;
}

void TestDisplacedRun() {
  auto clicks = GridTimes();
  for (size_t i = 15; i < 20; ++i) clicks[i] += 0.003;
  const Report report = Classify(Synthesize(clicks, 1.0, kRate), GridTimes());
  Check(
      report.intervals_off == 2,
      "run of 5 at +3 ms: entry and exit intervals off"
  );
  Check(
      report.dropped == 0 && report.doubled == 0,
      "run of 5 at +3 ms: no drop/double"
  );
  Check(
      !ThresholdFailures(Ungated(report)).empty(),
      "run of 5 at +3 ms: fails ungated"
  );
}

std::vector<double> Onsets(const std::vector<double>& grid, double scale) {
  std::vector<double> onsets;
  for (const double beat : grid) onsets.push_back(beat * scale);
  return onsets;
}

std::vector<double> Grid(double bpm, size_t beats) {
  std::vector<double> grid;
  for (size_t i = 0; i < beats; ++i) grid.push_back(i * 60.0 / bpm);
  return grid;
}

// Ten minutes of onsets: long enough that a 20 ms slip is ~33 ppm of tempo,
// so the interval gate alone must catch it.
void TestStall(size_t from_beat, const char* label) {
  const auto grid = Grid(120.0, 1200);
  auto onsets = grid;
  for (size_t i = from_beat; i < onsets.size(); ++i) onsets[i] += 0.020;
  const Report report = Ungated(Judge(onsets, grid));
  Check(report.intervals_off == 1, label);
  Check(
      report.dropped == 0 && report.doubled == 0 && report.jittered == 0,
      label
  );
  Check(Near(report.error_max_abs_ms, 20.0, 1e-6), label);
  Check(ThresholdFailures(report).size() == 1, label);
}

void TestTempoBudget() {
  const auto grid = Grid(120.0, 1200);
  const Report fast = Ungated(Judge(Onsets(grid, 120.0 / 120.1), grid));
  Check(
      Near(fast.tempo_error_ppm, -832.6, 1.0),
      "120.1 vs 120: -833 ppm measured"
  );
  Check(
      fast.intervals_off == 0 && fast.jittered == 0,
      "120.1 vs 120: every interval within tolerance"
  );
  Check(
      ThresholdFailures(fast).size() == 1,
      "120.1 vs 120: fails on tempo alone"
  );
  const Report drift = Ungated(Judge(Onsets(grid, 1.0001), grid));
  Check(Near(drift.tempo_error_ppm, 100.0, 1.0), "100 ppm drift: measured");
  Check(ThresholdFailures(drift).empty(), "100 ppm drift: passes");
}

// At 20 bpm a 200 ppm recorder moves 0.6 ms per beat; an off-centre median at
// the ends of the train would read that as jitter.
void TestSlowTempoDrift() {
  const auto grid = Grid(20.0, 30);
  const Report report = Ungated(Judge(Onsets(grid, 1.0002), grid));
  Check(report.jittered == 0, "20 bpm 200 ppm: train ends not flagged");
  Check(ThresholdFailures(report).empty(), "20 bpm 200 ppm: passes");
}

// Offset rises 0.4 ms/beat from beat 100 and holds at 6 ms: every interval and
// the whole-track mean pass, one late stretch does not.
std::vector<double> LateSongOffsets() {
  std::vector<double> offsets_ms(120, 0.0);
  for (size_t i = 100; i < 120; ++i) {
    offsets_ms[i] = 0.4 * static_cast<double>(std::min<size_t>(i, 115) - 100);
  }
  return offsets_ms;
}

void TestLateSongOffset() {
  auto clicks = GridTimes(120);
  const auto offsets_ms = LateSongOffsets();
  for (size_t i = 0; i < clicks.size(); ++i) {
    clicks[i] += offsets_ms[i] / 1000.0;
  }
  const Report report =
      Classify(Synthesize(clicks, 1.0, kRate), GridTimes(120));
  Check(
      report.offset_mean_abs_ms < 1.5,
      "late offset: whole-track mean stays small"
  );
  Check(
      report.intervals_off == 0 && report.jittered == 0,
      "late offset: intervals pass"
  );
  Check(
      report.offset_worst_window_ms > click_soak::kMaxWindowOffsetMs,
      "late offset: worst window over the limit"
  );
  Check(
      report.offset_worst_window_sec > GridTimes(120)[100],
      "late offset: located late in the song"
  );
  Check(
      ThresholdFailures(report).size() == 1,
      "late offset: fails on offset alone"
  );
}

void TestFourHourDriftPasses() {
  const auto grid = Grid(120.0, 4 * 3600 * 2);
  const Report report = Ungated(Judge(Onsets(grid, 1.0001), grid));
  Check(report.clicks_analysed == grid.size(), "4 h drift: every beat matched");
  Check(
      Near(report.offset_max_abs_ms, 1440.0, 1.0),
      "4 h drift: offset 1.44 s"
  );
  Check(ThresholdFailures(report).empty(), "4 h drift: soak passes");
}

}  // namespace

void RunTimingTests() {
  TestDisplacedRun();
  TestStall(600, "stall mid-run: one interval 20 ms off, nothing else");
  TestStall(1195, "stall near the end: one interval 20 ms off, nothing else");
  TestTempoBudget();
  TestSlowTempoDrift();
  TestLateSongOffset();
  TestFourHourDriftPasses();
}

}  // namespace soak_test
