#include "metronome_test_status_rig.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int64_t kBar100Bpm44 = 115200;
constexpr int64_t kBar100Bpm34 = 86400;

int64_t At(int64_t bar_frames, double bars) {
  return static_cast<int64_t>(static_cast<double>(bar_frames) * bars);
}

int32_t MutePosition(const StatusRig& rig) {
  return rig.metronome.trainer_mirrors().bar_mute_position();
}

void TestMutePositionCycles() {
  StatusRig rig;
  rig.metronome.SetTempo(100.0);
  rig.metronome.SetBarMute(true, 2, 2);
  rig.RenderTo(kBlockFrames);
  const bool stopped = MutePosition(rig) == -1;
  rig.metronome.Start();
  bool cycles = true;
  for (int bar = 0; bar < 6; ++bar) {
    rig.RenderTo(At(kBar100Bpm44, bar + 0.5));
    const bool muted = rig.metronome.bar_muted();
    cycles = cycles && MutePosition(rig) == bar % 4 && muted == (bar % 4 >= 2);
  }
  Check(stopped, "mute position: -1 while stopped");
  Check(cycles, "mute position: Play 2 / Mute 2 reads 0,1,2,3,0,1");
  rig.metronome.SetBarMute(false, 2, 2);
  rig.RenderTo(rig.rendered + kBlockFrames);
  Check(MutePosition(rig) == -1, "mute position: -1 once the trainer is off");
  rig.metronome.SetBarMute(true, 2, 2);
  rig.metronome.Stop();
  rig.RenderTo(rig.rendered + kBlockFrames);
  Check(MutePosition(rig) == -1, "mute position: -1 after stop");
}

void TestCountInBar() {
  StatusRig rig;
  rig.metronome.SetTempo(100.0);
  rig.metronome.SetTimeSignature(3, 4);
  rig.metronome.SetBarMute(true, 2, 2);
  rig.metronome.SetCountIn(2, true, 1);
  rig.RenderTo(kBlockFrames);
  const auto& mirrors = rig.metronome.trainer_mirrors();
  const bool idle = mirrors.count_in_bar() == -1;
  rig.metronome.Start();
  int32_t bars[3] = {};
  bool mute_hidden = true;
  const double samples[3] = {0.5, 1.2, 1.9};
  for (int i = 0; i < 3; ++i) {
    rig.RenderTo(At(kBar100Bpm34, samples[i]));
    bars[i] = mirrors.count_in_bar();
    mute_hidden = mute_hidden && mirrors.bar_mute_position() == -1;
  }
  rig.RenderTo(At(kBar100Bpm34, 2.5));
  Check(idle, "count-in bar: -1 before start");
  Check(
      bars[0] == 0 && bars[1] == 1 && bars[2] == 1,
      "count-in bar: 2 bars of 3/4 read 0 then 1, counted in 3-beat bars"
  );
  Check(mute_hidden, "mute position: -1 during count-in");
  Check(
      mirrors.count_in_bar() == -1 && mirrors.bar_mute_position() == 0,
      "count-in bar: -1 once bar one plays; mute position starts at 0"
  );
}

}  // namespace

void RunTrainerStatusTests() {
  TestMutePositionCycles();
  TestCountInBar();
}

}  // namespace metronome_test
