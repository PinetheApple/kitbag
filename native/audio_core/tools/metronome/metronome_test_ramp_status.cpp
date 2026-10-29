#include "metronome_test_status_rig.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::RampState;

struct Step {
  double next_bpm;
  double remaining;
  bool operator==(const Step&) const = default;
};

constexpr double kTolerance = 1e-6;
constexpr double kOneFrameProgress = 1e-4;
constexpr int64_t kTraceLimitFrames = int64_t{kSampleRate} * 60;
const std::vector<Step> kBarSteps = {
    {105, 3},
    {105, 2},
    {105, 1},
    {110, 4},
    {110, 3},
    {110, 2},
    {110, 1},
    {112, 4},
    {112, 3},
    {112, 2},
    {112, 1}
};
const std::vector<Step> kLoopSteps = {
    {105, 2},
    {105, 1},
    {110, 2},
    {110, 1},
    {100, 2},
    {100, 1},
    {105, 2},
    {105, 1},
    {110, 2}
};

bool Near(double actual, double expected) {
  return std::fabs(actual - expected) < kTolerance;
}

struct RampTrace {
  std::vector<Step> steps;
  bool bpm_followed = true;
  bool progress_rose = true;
  bool reached_target = false;
};

void RecordBlock(const StatusRig& rig, RampTrace* trace, double* progress) {
  const auto& mirrors = rig.metronome.trainer_mirrors();
  const Step step{mirrors.ramp_next_bpm(), mirrors.ramp_remaining()};
  const double now = mirrors.ramp_step_progress();
  const bool new_interval =
      trace->steps.empty() || step.next_bpm != trace->steps.back().next_bpm;
  if (!new_interval && now < *progress) trace->progress_rose = false;
  *progress = now;
  if (!trace->steps.empty() && new_interval) {
    trace->bpm_followed =
        trace->bpm_followed &&
        rig.metronome.current_bpm() == trace->steps.back().next_bpm;
  }
  if (trace->steps.empty() || step != trace->steps.back()) {
    trace->steps.push_back(step);
  }
}

RampTrace TraceRamp(StatusRig& rig, size_t max_steps) {
  RampTrace trace;
  double progress = 0.0;
  while (rig.rendered < kTraceLimitFrames && trace.steps.size() < max_steps) {
    rig.RenderBlock();
    const RampState state = rig.metronome.trainer_mirrors().ramp_state();
    if (state == RampState::kAtTarget) {
      trace.reached_target = true;
      return trace;
    }
    if (state == RampState::kStepping) RecordBlock(rig, &trace, &progress);
  }
  return trace;
}

void CheckSetTempoCancels(StatusRig& rig) {
  rig.metronome.SetTempo(90.0);
  rig.RenderBlock();
  const auto& mirrors = rig.metronome.trainer_mirrors();
  Check(
      mirrors.ramp_state() == RampState::kOff &&
          mirrors.ramp_step_progress() == 0.0,
      "ramp state: set_tempo cancels to OFF with progress 0"
  );
}

void CheckStoppedThenMidBar(StatusRig& rig) {
  rig.RenderBlock();
  const auto& mirrors = rig.metronome.trainer_mirrors();
  Check(
      mirrors.ramp_state() == RampState::kOff,
      "ramp state: OFF while stopped"
  );
  rig.metronome.Start();
  rig.RenderTo(kBlockFrames + At(kBar100Bpm44, 1.5));
  Check(
      std::fabs(mirrors.ramp_step_progress() - 0.375) < kOneFrameProgress &&
          Near(mirrors.ramp_remaining(), 3.0),
      "ramp progress: halfway into bar 2 of 4 is 0.375 with 3 bars left"
  );
}

void TestBarRampSteps() {
  StatusRig rig;
  rig.metronome.SetRamp(true, 100.0, 112.0, 5.0, 4.0, kRampBars, false);
  CheckStoppedThenMidBar(rig);
  const auto& mirrors = rig.metronome.trainer_mirrors();
  const RampTrace trace = TraceRamp(rig, kBarSteps.size() + 1);
  Check(
      trace.steps == kBarSteps,
      "ramp bars: next 105/110/112 (clamped), remaining counts 4 down to 1"
  );
  Check(
      trace.bpm_followed && trace.progress_rose,
      "ramp bars: each step lands on the announced tempo; progress only rises"
  );
  Check(
      trace.reached_target && mirrors.ramp_next_bpm() == 0.0 &&
          mirrors.ramp_remaining() == 0.0 &&
          mirrors.ramp_step_progress() == 1.0 &&
          rig.metronome.current_bpm() == 112.0,
      "ramp bars: AT_TARGET on 112 with next 0, remaining 0, progress 1"
  );
  CheckSetTempoCancels(rig);
}

void TestLoopAnnouncesRestart() {
  StatusRig rig;
  rig.metronome.SetRamp(true, 100.0, 110.0, 5.0, 2.0, kRampBars, true);
  rig.metronome.Start();
  const RampTrace trace = TraceRamp(rig, kLoopSteps.size());
  Check(
      trace.steps == kLoopSteps && !trace.reached_target && trace.bpm_followed,
      "ramp loop: at the 110 target it stays STEPPING and announces 100 next"
  );
}

struct TimeSample {
  RampState state;
  double next;
  double remaining;
  double progress;
  double bpm;
};

TimeSample SampleAt(StatusRig& rig, int64_t frame) {
  rig.RenderTo(frame);
  const auto& mirrors = rig.metronome.trainer_mirrors();
  return {
      mirrors.ramp_state(),
      mirrors.ramp_next_bpm(),
      mirrors.ramp_remaining(),
      mirrors.ramp_step_progress(),
      rig.metronome.current_bpm()
  };
}

void TestSecondsRampRemaining() {
  StatusRig rig;
  rig.metronome.SetRamp(true, 60.0, 120.0, 10.0, 4.5, kRampSeconds, false);
  rig.metronome.Start();
  const TimeSample early = SampleAt(rig, Seconds(2.0));
  const TimeSample waiting = SampleAt(rig, Seconds(4.75));
  const TimeSample stepped = SampleAt(rig, Seconds(6.0));
  Check(
      early.next == 70.0 && Near(early.remaining, 2.5) &&
          Near(early.progress, 2.0 / 4.5),
      "ramp seconds: 2 s into 4.5 s, 2.5 s remain before 70"
  );
  Check(
      waiting.state == RampState::kStepping && waiting.next == 70.0 &&
          waiting.remaining == 0.0 && waiting.progress == 1.0 &&
          waiting.bpm == 60.0,
      "ramp seconds: past 4.5 s, remaining clamps to 0 until the next beat"
  );
  Check(
      stepped.next == 80.0 && stepped.bpm == 70.0 &&
          Near(stepped.remaining, 3.0) && Near(stepped.progress, 1.5 / 4.5),
      "ramp seconds: the next interval counts from 4.5 s, not the late beat"
  );
}

void TestGridTurnsRampOff() {
  StatusRig rig;
  rig.metronome.SetRamp(true, 100.0, 120.0, 5.0, 2.0, kRampBars, false);
  rig.metronome.Start();
  rig.RenderBlock();
  const bool stepping =
      rig.metronome.trainer_mirrors().ramp_state() == RampState::kStepping;
  rig.metronome.SetGrid(MakeShiftedGrid(40, 0.0, 0.5), 0, true);
  rig.RenderBlock();
  Check(
      stepping &&
          rig.metronome.trainer_mirrors().ramp_state() == RampState::kOff,
      "ramp state: OFF while a beat grid owns the clock"
  );
}

}  // namespace

void RunRampStatusTests() {
  TestBarRampSteps();
  TestLoopAnnouncesRestart();
  TestSecondsRampRemaining();
  TestGridTurnsRampOff();
}

}  // namespace metronome_test
