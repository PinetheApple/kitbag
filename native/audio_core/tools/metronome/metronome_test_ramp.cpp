#include "metronome/metronome_internal.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kSecondsPerMinute;

constexpr double kRampJitterFrames = 3.0;
constexpr int64_t kRenderMarginFrames = 1000;
constexpr double kReferenceDenominator = 4.0;

int64_t Seconds(int64_t seconds) {
  return seconds * kSampleRate;
}

struct RampCase {
  double start_bpm;
  double target_bpm;
  double step_bpm;
  double interval;
  int32_t unit;
  bool loop;
  int beats;
  int denominator;
};

void StartRamp(kitbag::Metronome& metronome, const RampCase& ramp) {
  metronome.SetRamp(
      true,
      ramp.start_bpm,
      ramp.target_bpm,
      ramp.step_bpm,
      ramp.interval,
      ramp.unit,
      ramp.loop
  );
  metronome.Start();
}

double BeatSeconds(const RampCase& ramp, double bpm) {
  return kSecondsPerMinute / (bpm * ramp.denominator / kReferenceDenominator);
}

double IntervalSeconds(const RampCase& ramp) {
  return ramp.unit == kRampMinutes ? ramp.interval * kSecondsPerMinute
                                   : ramp.interval;
}

struct ModelCycle {
  double start_seconds = 0.0;
  int start_bar = 0;
};

int64_t IntervalsSince(
    const RampCase& ramp,
    const ModelCycle& cycle,
    int bar,
    double elapsed
) {
  if (ramp.unit == kRampBars) {
    return static_cast<int64_t>((bar - cycle.start_bar) / ramp.interval);
  }
  return static_cast<int64_t>(
      (elapsed - cycle.start_seconds) / IntervalSeconds(ramp)
  );
}

// The tempo of each beat, written from SPEC §5.3 rather than from the engine.
std::vector<double> ModelBeatBpms(const RampCase& ramp, int total_beats) {
  const auto steps = static_cast<int64_t>(
      std::ceil(std::fabs(ramp.target_bpm - ramp.start_bpm) / ramp.step_bpm)
  );
  std::vector<double> bpms;
  double bpm = ramp.start_bpm;
  double elapsed = 0.0;
  ModelCycle cycle;
  for (int beat = 0; beat < total_beats; ++beat) {
    const int bar = beat / ramp.beats;
    if (ramp.unit != kRampBars || beat % ramp.beats == 0) {
      int64_t intervals = IntervalsSince(ramp, cycle, bar, elapsed);
      if (ramp.loop && intervals > steps) {
        cycle = {elapsed, bar};
        intervals = 0;
      }
      bpm =
          ModelTempo(ramp.start_bpm, ramp.target_bpm, ramp.step_bpm, intervals);
    }
    bpms.push_back(bpm);
    elapsed += BeatSeconds(ramp, bpm);
  }
  return bpms;
}

int CountTempoMismatches(
    const std::vector<int64_t>& onsets,
    size_t first,
    const RampCase& ramp,
    const std::vector<double>& bpms
) {
  int mismatches = 0;
  for (size_t beat = 0; beat < bpms.size(); ++beat) {
    const size_t i = first + beat;
    if (i + 1 >= onsets.size()) return mismatches + 1;
    const double expected = BeatSeconds(ramp, bpms[beat]) * kSampleRate;
    const auto spacing = static_cast<double>(onsets[i + 1] - onsets[i]);
    if (std::fabs(spacing - expected) > kRampJitterFrames) ++mismatches;
  }
  return mismatches;
}

void ExpectRamp(const RampCase& ramp, int bars, const char* label) {
  kitbag::Metronome metronome;
  metronome.SetTempo(ramp.start_bpm);
  metronome.SetTimeSignature(ramp.beats, ramp.denominator);
  StartRamp(metronome, ramp);
  const auto bpms = ModelBeatBpms(ramp, bars * ramp.beats);
  double seconds = 0.0;
  for (const double bpm : bpms) seconds += BeatSeconds(ramp, bpm);
  const auto frames =
      static_cast<int64_t>(seconds * kSampleRate) + kRenderMarginFrames;
  const auto onsets = RenderAndDetectOnsets(metronome, frames);
  Check(CountTempoMismatches(onsets, 0, ramp, bpms) == 0, label);
}

void TestModelFixture() {
  const RampCase ramp{90.0, 150.0, 20.0, 2.0, kRampBars, false, 3, 4};
  const auto bpms = ModelBeatBpms(ramp, 24);
  const std::vector<double>
      bars{90.0, 90.0, 110.0, 110.0, 130.0, 130.0, 150.0, 150.0};
  bool same = bpms.size() == 24;
  for (size_t beat = 0; same && beat < bpms.size(); ++beat) {
    same = bpms[beat] == bars[beat / 3];
  }
  Check(same, "ramp model: 90->150 by 20 every 2 bars, holding the target");
}

void TestBarRamps() {
  ExpectRamp(
      {90.0, 150.0, 20.0, 2.0, kRampBars, false, 3, 4},
      9,
      "ramp: 3/4 up 20 BPM every 2 bars, stops on 150"
  );
  ExpectRamp(
      {200.0, 120.0, 30.0, 1.0, kRampBars, false, 7, 8},
      6,
      "ramp: 7/8 down 30 every bar, last step lands on 120"
  );
  ExpectRamp(
      {100.0, 120.0, 10.0, 1.0, kRampBars, true, 4, 4},
      8,
      "ramp: looping holds 120 one bar, then starts again at 100"
  );
}

void TestTimeRamps() {
  ExpectRamp(
      {60.0, 66.0, 2.0, 4.5, kRampSeconds, false, 4, 4},
      6,
      "ramp: +2 BPM every 4.5 s steps on the next beat"
  );
  ExpectRamp(
      {126.0, 120.0, 3.0, 0.21, kRampMinutes, false, 3, 4},
      18,
      "ramp: -3 BPM every 0.21 min, in 3/4"
  );
}

void TestLoopWithLatencyKeepsEveryClick() {
  const auto render = [](double latency_ms) {
    kitbag::Metronome metronome;
    metronome.SetLatencyOffset(latency_ms);
    metronome.SetRamp(true, 240.0, 60.0, 180.0, 1.0, kRampBars, true);
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
  const RampCase ramp{100.0, 200.0, 25.0, 1.0, kRampBars, true, 4, 4};
  kitbag::Metronome metronome;
  StartRamp(metronome, ramp);
  const auto bar_one =
      static_cast<int64_t>(4 * BeatSeconds(ramp, 100.0) * kSampleRate);
  const auto onsets = RenderContinuous(
      metronome,
      Seconds(16),
      OnceAtFrame(bar_one + kBlockFrames, [&](int64_t) {
        metronome.SetTempo(90.0);
      })
  );
  const RampCase held{90.0, 90.0, 1.0, 1.0, kRampBars, false, 4, 4};
  Check(
      CountTempoMismatches(onsets, 6, held, std::vector<double>(16, 90.0)) == 0,
      "ramp cancel: manual tempo holds every later beat"
  );
  metronome.Stop();
  metronome.Start();
  const auto restarted = RenderAndDetectOnsets(metronome, Seconds(3));
  Check(
      CountTempoMismatches(restarted, 0, held, std::vector<double>(4, 90.0)) ==
          0,
      "ramp cancel: restarting does not bring the ramp back"
  );
}

void TestInvalidRampKeepsPrevious() {
  const RampCase ramp{100.0, 160.0, 20.0, 1.0, kRampBars, false, 4, 4};
  kitbag::Metronome metronome;
  metronome.SetRamp(
      true,
      ramp.start_bpm,
      ramp.target_bpm,
      ramp.step_bpm,
      ramp.interval,
      ramp.unit,
      ramp.loop
  );
  metronome.SetRamp(true, 60.0, 70.0, 0.0, 1.0, kRampBars, false);
  metronome.SetRamp(true, 60.0, 70.0, 5.0, 1.0, kRampMinutes + 1, false);
  metronome.SetRamp(true, INFINITY, 70.0, 5.0, 1.0, kRampBars, false);
  metronome.SetRamp(true, 60.0, 70.0, NAN, 1.0, kRampBars, false);
  metronome.SetRamp(true, 60.0, 70.0, 5.0, -INFINITY, kRampBars, false);
  metronome.Start();
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(12));
  Check(
      CountTempoMismatches(onsets, 0, ramp, ModelBeatBpms(ramp, 20)) == 0,
      "ramp: zero step, bad unit and non-finite input keep the previous ramp"
  );
}

void TestTimeRampStartsAtBarOne() {
  const RampCase ramp{60.0, 66.0, 2.0, 4.5, kRampSeconds, false, 4, 4};
  kitbag::Metronome metronome;
  metronome.SetTempo(60.0);
  metronome.SetCountIn(1, true, 1);
  StartRamp(metronome, ramp);
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(20));
  Check(
      CountTempoMismatches(onsets, 4, ramp, ModelBeatBpms(ramp, 12)) == 0,
      "ramp: time runs from bar one, not from the count-in"
  );
}

void TestStopStartReplaysTimeRamp() {
  const RampCase ramp{60.0, 66.0, 2.0, 4.5, kRampSeconds, false, 4, 4};
  kitbag::Metronome metronome;
  StartRamp(metronome, ramp);
  RenderAndDetectOnsets(metronome, Seconds(7));
  metronome.Stop();
  metronome.Start();
  const auto onsets = RenderAndDetectOnsets(metronome, Seconds(14));
  Check(
      CountTempoMismatches(onsets, 0, ramp, ModelBeatBpms(ramp, 12)) == 0,
      "ramp: stop then start replays a time ramp from its start"
  );
}

}  // namespace

void RunRampTests() {
  TestModelFixture();
  TestBarRamps();
  TestTimeRamps();
  TestLoopWithLatencyKeepsEveryClick();
  TestManualTempoCancels();
  TestInvalidRampKeepsPrevious();
  TestTimeRampStartsAtBarOne();
  TestStopStartReplaysTimeRamp();
}

}  // namespace metronome_test
