#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr double kRampJitterFrames = 3.0;
constexpr double kFixtureTolerance = 1e-5;
constexpr int64_t kRenderMarginFrames = 1000;
constexpr double kSecondsPerMinute = 60.0;
constexpr double kReferenceDenominator = 4.0;

int64_t Seconds(int64_t seconds) {
  return seconds * kSampleRate;
}

struct RampCase {
  double start_bpm;
  double end_bpm;
  double duration;
  int32_t unit;
  bool loop;
  int beats;
  int denominator;
};

void StartRamp(kitbag::Metronome& metronome, const RampCase& ramp) {
  metronome.SetRamp(
      true,
      ramp.start_bpm,
      ramp.end_bpm,
      ramp.duration,
      ramp.unit,
      ramp.loop
  );
  metronome.Start();
}

double BarSeconds(const RampCase& ramp, double bpm) {
  return ramp.beats * kSecondsPerMinute /
         (bpm * ramp.denominator / kReferenceDenominator);
}

double RampLength(const RampCase& ramp) {
  if (ramp.unit == kRampBars) return std::round(ramp.duration);
  if (ramp.unit == kRampMinutes) return ramp.duration * kSecondsPerMinute;
  return ramp.duration;
}

std::vector<double> ModelBarBpms(const RampCase& ramp, int bars) {
  std::vector<double> bpms;
  double elapsed = 0.0;
  int cycle_bar = 0;
  bool at_end = false;
  for (int bar = 0; bar < bars; ++bar) {
    if (at_end && ramp.loop) {
      cycle_bar = bar;
      elapsed = 0.0;
    }
    const double progress = ramp.unit == kRampBars
                                ? (bar - cycle_bar) / RampLength(ramp)
                                : elapsed / RampLength(ramp);
    at_end = progress >= 1.0;
    const double bpm = ramp.start_bpm + (ramp.end_bpm - ramp.start_bpm) *
                                            std::min(progress, 1.0);
    bpms.push_back(bpm);
    elapsed += BarSeconds(ramp, bpm);
  }
  return bpms;
}

void TestModelFixture() {
  const RampCase ramp{60.0, 120.0, 10.0, kRampSeconds, false, 4, 4};
  const auto bpms = ModelBarBpms(ramp, 5);
  const double expected[] = {60.0, 84.0, 708.0 / 7.0, 115.380145, 120.0};
  bool matches = true;
  for (size_t i = 0; i < bpms.size(); ++i) {
    matches = matches && std::fabs(bpms[i] - expected[i]) < kFixtureTolerance;
  }
  Check(
      matches,
      "ramp fixture: 60->120 over 10 s in 4/4 is 60, 84, 101.1, 115.4, 120"
  );
}

int CountTempoMismatches(
    const std::vector<int64_t>& onsets,
    size_t first,
    const RampCase& ramp,
    const std::vector<double>& bpms
) {
  int mismatches = 0;
  for (size_t bar = 0; bar < bpms.size(); ++bar) {
    const double expected =
        BarSeconds(ramp, bpms[bar]) / ramp.beats * kSampleRate;
    for (int beat = 0; beat < ramp.beats; ++beat) {
      const size_t i = first + bar * ramp.beats + beat;
      if (i + 1 >= onsets.size()) return mismatches + 1;
      const auto spacing = static_cast<double>(onsets[i + 1] - onsets[i]);
      if (std::fabs(spacing - expected) > kRampJitterFrames) ++mismatches;
    }
  }
  return mismatches;
}

void ExpectRamp(const RampCase& ramp, int bars, const char* label) {
  kitbag::Metronome metronome;
  metronome.SetTempo(ramp.start_bpm);
  metronome.SetTimeSignature(ramp.beats, ramp.denominator);
  StartRamp(metronome, ramp);
  const auto bpms = ModelBarBpms(ramp, bars);
  double seconds = 0.0;
  for (const double bpm : bpms) seconds += BarSeconds(ramp, bpm);
  const auto frames =
      static_cast<int64_t>(seconds * kSampleRate) + kRenderMarginFrames;
  const auto onsets = RenderAndDetectOnsets(metronome, frames);

  const bool exact_count =
      onsets.size() == static_cast<size_t>(bars) * ramp.beats + 1;
  Check(exact_count && CountTempoMismatches(onsets, 0, ramp, bpms) == 0, label);
}

void TestBarRamps() {
  ExpectRamp(
      {90.0, 150.0, 3.0, kRampBars, false, 3, 4},
      6,
      "ramp: 3/4 up over 3 bars then holds"
  );
  ExpectRamp(
      {200.0, 120.0, 4.0, kRampBars, true, 7, 8},
      11,
      "ramp: 7/8 down over 4 bars, looping"
  );
}

void TestSecondRamps() {
  ExpectRamp(
      {60.0, 120.0, 10.0, kRampSeconds, false, 4, 4},
      7,
      "ramp: 4/4 up over 10 s then holds"
  );
  ExpectRamp(
      {180.0, 90.0, 7.0, kRampSeconds, true, 6, 8},
      12,
      "ramp: 6/8 down over 7 s, looping"
  );
}

void TestMinuteRamps() {
  ExpectRamp(
      {80.0, 160.0, 1.0, kRampMinutes, false, 4, 4},
      26,
      "ramp: 4/4 up over 1 min then holds"
  );
  ExpectRamp(
      {150.0, 75.0, 1.0, kRampMinutes, true, 5, 4},
      30,
      "ramp: 5/4 down over 1 min, looping"
  );
}

void TestLoopWithLatencyKeepsEveryClick() {
  const auto render = [](double latency_ms) {
    kitbag::Metronome metronome;
    metronome.SetLatencyOffset(latency_ms);
    metronome.SetRamp(true, 240.0, 60.0, 1.0, kRampBars, true);
    metronome.Start();
    return RenderAndDetectOnsets(metronome, Seconds(16));
  };
  const auto without = render(0.0);
  const auto with = render(100.0);
  bool same = without.size() == with.size() && without.size() > 20;
  for (size_t i = 0; same && i < without.size(); ++i) {
    same = std::abs(with[i] - without[i]) <= 1;
  }
  Check(same, "ramp loop: 60<->240 jumps under +100 ms add or drop no click");
}

void TestManualTempoCancels() {
  const RampCase ramp{100.0, 200.0, 4.0, kRampBars, true, 4, 4};
  kitbag::Metronome metronome;
  StartRamp(metronome, ramp);
  const int64_t bar_one =
      static_cast<int64_t>(BarSeconds(ramp, 100.0) * kSampleRate);
  const auto onsets = RenderContinuous(
      metronome,
      Seconds(16),
      OnceAtFrame(bar_one + kBlockFrames, [&](int64_t) {
        metronome.SetTempo(90.0);
      })
  );
  const RampCase held{90.0, 90.0, 1.0, kRampBars, false, 4, 4};
  Check(
      CountTempoMismatches(onsets, 5, held, std::vector<double>(4, 90.0)) == 0,
      "ramp cancel: a manual tempo holds for every later bar"
  );
  metronome.Stop();
  metronome.Start();
  const auto restarted = RenderAndDetectOnsets(metronome, Seconds(3));
  Check(
      CountTempoMismatches(restarted, 0, held, {90.0}) == 0,
      "ramp cancel: a restart does not replay the cancelled ramp"
  );
}

void TestInvalidRampKeepsPrevious() {
  const RampCase ramp{100.0, 200.0, 4.0, kRampBars, false, 4, 4};
  kitbag::Metronome metronome;
  metronome.SetRamp(
      true,
      ramp.start_bpm,
      ramp.end_bpm,
      ramp.duration,
      ramp.unit,
      ramp.loop
  );
  metronome.SetRamp(true, 60.0, 70.0, std::nan(""), kRampSeconds, true);
  metronome.SetRamp(true, 60.0, 70.0, 2.0, kRampMinutes + 1, true);
  metronome.Start();
  const auto bpms = ModelBarBpms(ramp, 6);
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(13));
  Check(
      CountTempoMismatches(onsets, 0, ramp, bpms) == 0,
      "ramp: a non-finite duration or unknown unit keeps the previous ramp"
  );
}

void TestTimeRampStartsAtBarOne() {
  const RampCase ramp{60.0, 120.0, 10.0, kRampSeconds, false, 4, 4};
  kitbag::Metronome metronome;
  metronome.SetTempo(60.0);
  metronome.SetCountIn(1, true, 1);
  StartRamp(metronome, ramp);
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(20));
  Check(
      CountTempoMismatches(onsets, 4, ramp, ModelBarBpms(ramp, 4)) == 0,
      "ramp: time runs from bar one, not from the count-in"
  );
}

void TestStopStartReplaysTimeRamp() {
  const RampCase ramp{60.0, 120.0, 10.0, kRampSeconds, false, 4, 4};
  kitbag::Metronome metronome;
  StartRamp(metronome, ramp);
  RenderAndDetectOnsets(metronome, Seconds(7));
  metronome.Stop();
  metronome.Start();
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(12));
  Check(
      CountTempoMismatches(onsets, 0, ramp, ModelBarBpms(ramp, 4)) == 0,
      "ramp: stop then start replays a time ramp from its start"
  );
}

}  // namespace

void RunRampTests() {
  TestModelFixture();
  TestBarRamps();
  TestSecondRamps();
  TestMinuteRamps();
  TestLoopWithLatencyKeepsEveryClick();
  TestManualTempoCancels();
  TestInvalidRampKeepsPrevious();
  TestTimeRampStartsAtBarOne();
  TestStopStartReplaysTimeRamp();
}

}  // namespace metronome_test
