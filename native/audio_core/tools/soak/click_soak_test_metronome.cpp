#include "soak_cli.h"
#include "soak_fixtures.h"
#include "soak_metronome_render.h"
#include "wav_fixture.h"

namespace soak_test {

namespace {

using click_soak::Report;

constexpr double kEngineBpm = 137.0;
constexpr double kEngineSeconds = 29.0;
// The render runs past beat 66's slot, so a 67th click lands outside the grid.
constexpr size_t kEngineBeats = 66;

std::vector<float> Mono(const std::vector<float>& stereo) {
  std::vector<float> mono;
  for (size_t i = 0; i + 1 < stereo.size(); i += 2) {
    mono.push_back(0.5F * (stereo[i] + stereo[i + 1]));
  }
  return mono;
}

void Expect(bool condition, const std::string& label, const char* what) {
  Check(condition, (label + ": " + what).c_str());
}

// The engine fires on the first whole frame at or after the beat and a voice's
// first sample is sin(0), so each onset trails its beat by 1 to 2 samples.
void ExpectClean(const Report& r, const std::string& label) {
  Expect(r.clicks_analysed == kEngineBeats, label, "66 clicks analysed");
  Expect(r.onsets_detected == kEngineBeats + 1, label, "67 onsets");
  Expect(r.outside_grid == 1, label, "one click past the last slot");
  Expect(r.dropped == 0 && r.doubled == 0, label, "no drop/double");
  Expect(r.jittered == 0 && r.intervals_off == 0, label, "no jitter");
  Expect(
      r.error_max_abs_ms <= kOneSampleMs,
      label,
      "interval error <= 1 sample"
  );
  Expect(
      r.offset_mean_ms >= kOneSampleMs,
      label,
      "onsets trail by >= 1 sample"
  );
  Expect(
      r.offset_max_abs_ms <= 2.0 * kOneSampleMs,
      label,
      "offset <= 2 samples"
  );
}

void TestRenderInMemory(const std::vector<float>& stereo) {
  const std::vector<float> mono = Mono(stereo);
  const double seconds = static_cast<double>(mono.size()) / kRate;
  const auto grid = click_soak::BpmGrid(0.0, kEngineBpm, seconds);
  click_soak::DetectionLevels levels;
  const auto onsets =
      click_soak::DetectOnsets(mono, kRate, 60.0 / kEngineBpm, &levels);
  const Report report = click_soak::ClassifyClicks(onsets, grid, seconds);
  Check(
      report.beats_expected == kEngineBeats,
      "engine: 66 beats fit in 29 s at 137 bpm"
  );
  ExpectClean(report, "engine in memory");
}

void TestRenderThroughFile(const std::vector<float>& stereo) {
  const std::string path = TempPath("metronome.wav");
  Check(
      media_test::WriteFloatWav(
          path,
          stereo,
          click_soak::kRenderChannels,
          kRate
      ),
      "engine: WAV written"
  );
  const auto analysis = click_soak::Analyse(
      {path, "--bpm", std::to_string(kEngineBpm), "--first-beat-ms", "0"}
  );
  Check(analysis.code == click_soak::ExitCode::kPass, "engine file: exit pass");
  ExpectClean(analysis.report, "engine file: clean pass");
  std::remove(path.c_str());
}

std::string
WriteRender(const std::string& name, const std::vector<float>& stereo) {
  const std::string path = TempPath(name);
  Check(
      media_test::WriteFloatWav(
          path,
          stereo,
          click_soak::kRenderChannels,
          kRate
      ),
      "engine: fault WAV written"
  );
  return path;
}

// Zero frames spliced in a quarter beat after a click: the engine's output
// stalls and every later click arrives late.
std::vector<float>
Stalled(std::vector<float> stereo, double at_sec, double stall_ms) {
  const auto at =
      static_cast<size_t>(at_sec * kRate) * click_soak::kRenderChannels;
  const auto frames = static_cast<size_t>(stall_ms * kRate / 1000.0);
  stereo.insert(
      stereo.begin() + static_cast<std::ptrdiff_t>(at),
      frames * click_soak::kRenderChannels,
      0.0F
  );
  return stereo;
}

void TestStallFails(
    double at_sec,
    const char* origin_ms,
    const std::string& label
) {
  const auto clean = click_soak::RenderMetronome(120.0, 60.0, kRate);
  const std::string path =
      WriteRender("stall.wav", Stalled(clean, at_sec, 20.0));
  std::vector<std::string> args = {path, "--bpm", "120"};
  if (origin_ms != nullptr) {
    args.insert(args.end(), {"--first-beat-ms", origin_ms});
  }
  const auto analysis = click_soak::Analyse(args);
  Expect(
      analysis.code == click_soak::ExitCode::kThresholdsFailed,
      label,
      "fails"
  );
  Expect(analysis.report.intervals_off == 1, label, "one interval off");
  Expect(
      Near(analysis.report.error_max_abs_ms, 20.0, kTightMs),
      label,
      "by 20 ms"
  );
  std::remove(path.c_str());
}

void TestTempoErrorFails() {
  const auto fast = click_soak::RenderMetronome(120.1, 60.0, kRate);
  const std::string path = WriteRender("fast.wav", fast);
  const auto analysis = click_soak::Analyse({path, "--bpm", "120"});
  const Report& r = analysis.report;
  Check(
      analysis.code == click_soak::ExitCode::kThresholdsFailed,
      "engine 120.1 vs 120: fails"
  );
  Check(
      r.intervals_off == 0 && r.jittered == 0,
      "engine 120.1 vs 120: no interval over 1 ms"
  );
  Check(Near(r.tempo_error_ppm, -832.6, 2.0), "engine 120.1 vs 120: -833 ppm");
  Check(
      analysis.failures.size() == 1,
      "engine 120.1 vs 120: tempo is the only failure"
  );
  std::remove(path.c_str());
}

}  // namespace

void RunMetronomeTests() {
  const std::vector<float> stereo =
      click_soak::RenderMetronome(kEngineBpm, kEngineSeconds, kRate);
  TestRenderInMemory(stereo);
  TestRenderThroughFile(stereo);
  TestStallFails(30.125, nullptr, "engine stall mid-run, soak mode");
  TestStallFails(58.125, nullptr, "engine stall near the end, soak mode");
  TestStallFails(58.125, "0", "engine stall near the end, gated");
  TestTempoErrorFails();
}

}  // namespace soak_test
