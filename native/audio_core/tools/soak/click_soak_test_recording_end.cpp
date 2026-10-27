#include <algorithm>

#include "soak_cli.h"
#include "soak_fixtures.h"
#include "wav_fixture.h"

namespace soak_test {

namespace {

using click_soak::Report;

// A recorder slower than the DAC stretches the file (positive ppm), so a
// nominal grid would hold beats past the last click; a faster one compresses
// it, so the last clicks would land past the nominal grid's end.
std::vector<double>
Drifted(size_t beats, double interval, double origin, double ppm) {
  std::vector<double> onsets;
  for (size_t i = 0; i < beats; ++i) {
    onsets.push_back(
        origin + (static_cast<double>(i) * interval * (1.0 + ppm * 1e-6))
    );
  }
  return onsets;
}

// Ends within one beat after the last click's slot, where the old nominal cut
// disagrees: slow recorders kept a beat past the last click, fast ones lost it.
double
DisputedEnd(const std::vector<double>& onsets, double interval, double ppm) {
  const auto spans = static_cast<double>(onsets.size() - 1);
  const double drift =
      std::min(std::fabs(ppm) * 1e-6 * interval * spans, interval);
  const double past_slot = ppm > 0.0 ? interval - (0.5 * drift) : 0.5 * drift;
  return onsets.back() + (0.5 * interval) + past_slot;
}

void TestFourHourEnds(double ppm, const std::string& label) {
  const double interval = 0.5;
  const auto onsets = Drifted(4 * 3600 * 2, interval, 0.0, ppm);
  const double end = DisputedEnd(onsets, interval, ppm);
  const auto grid = click_soak::BpmGrid(0.0, 120.0, end);
  const Report r = click_soak::ClassifyClicks(onsets, grid, end);
  Check(
      r.dropped == 0,
      (label + ": no phantom drop past the last click").c_str()
  );
  Check(r.outside_grid == 0, (label + ": no click left unjudged").c_str());
  Check(
      r.clicks_analysed == onsets.size(),
      (label + ": every click judged").c_str()
  );
}

constexpr uint32_t kLowRate = 8000;

std::string WriteTrain(const std::vector<double>& onsets, double end) {
  std::vector<float> mono(static_cast<size_t>(end * kLowRate), 0.0F);
  for (const double t : onsets) AddClick(&mono, t, 0.6, kLowRate);
  const std::string path = TempPath("drift_end.wav");
  Check(
      media_test::WriteFloatWav(path, mono, 1, kLowRate),
      "drift end: WAV written"
  );
  return path;
}

// Ralph's case: 400 bpm for 300 s with a recorder 290 ppm off, through the file.
void TestFileEnds(double ppm, const std::string& label) {
  const double interval = 60.0 / 400.0;
  const auto onsets = Drifted(2000, interval, 0.1, ppm);
  const double end = DisputedEnd(onsets, interval, ppm);
  const std::string path = WriteTrain(onsets, end);
  const auto analysis = click_soak::Analyse({path, "--bpm", "400"});
  const Report& r = analysis.report;
  Check(
      analysis.code == click_soak::ExitCode::kPass,
      (label + ": passes").c_str()
  );
  Check(
      r.dropped == 0 && r.outside_grid == 0,
      (label + ": no phantom drop, nothing unjudged").c_str()
  );
  Check(
      r.clicks_analysed == onsets.size(),
      (label + ": all 2000 clicks judged").c_str()
  );
  std::remove(path.c_str());
}

}  // namespace

void RunRecordingEndTests() {
  TestFourHourEnds(100.0, "4 h, recorder slow 100 ppm");
  TestFourHourEnds(-100.0, "4 h, recorder fast 100 ppm");
  TestFileEnds(290.0, "file 400 bpm, recorder slow 290 ppm");
  TestFileEnds(-290.0, "file 400 bpm, recorder fast 290 ppm");
}

}  // namespace soak_test
