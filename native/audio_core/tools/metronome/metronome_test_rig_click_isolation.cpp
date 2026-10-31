#include "metronome_test_audio.h"
#include "metronome_test_rig_model.h"

namespace metronome_test {
namespace {

using kitbag::Accent;
using kitbag::Metronome;
using kitbag::RampState;

constexpr RigCase kRig = {100, 4};
constexpr int64_t kRigOn = 10 * int64_t{kBlockFrames};
constexpr int64_t kRigMid = kRigOn + 400 * int64_t{kBlockFrames};
constexpr int64_t kRigOff = kRigOn + 800 * int64_t{kBlockFrames};
constexpr int64_t kMetronomeOn = kRigOff + 400 * int64_t{kBlockFrames};
constexpr int64_t kTailsGone = kMetronomeOn + 100 * int64_t{kBlockFrames};
constexpr int64_t kTwinFrames = kMetronomeOn + 3 * int64_t{kSampleRate};
constexpr int64_t kStartAtDelay = 1000;

struct MetronomeView {
  bool running;
  int32_t beat;
  int32_t poly_beat;
  double poly_phase;
  double bar_phase;
  double bpm;
  bool bar_muted;
  int32_t mute_position;
  bool counting_in;
  int32_t count_in_bar;
  int32_t count_in_total;
  RampState ramp_state;
  double ramp_next_bpm;
  double ramp_remaining;
  double ramp_progress;
  bool operator==(const MetronomeView&) const = default;
};

MetronomeView View(const Metronome& metronome) {
  const kitbag::TrainerMirrors& trainer = metronome.trainer_mirrors();
  return {
      metronome.is_running(),
      metronome.current_beat(),
      metronome.current_poly_beat(),
      metronome.poly_downbeat_phase(),
      metronome.bar_phase(),
      metronome.current_bpm(),
      trainer.bar_muted(),
      trainer.bar_mute_position(),
      trainer.counting_in(),
      trainer.count_in_bar(),
      trainer.count_in_bars_total(),
      trainer.ramp_state(),
      trainer.ramp_next_bpm(),
      trainer.ramp_remaining(),
      trainer.ramp_step_progress(),
  };
}

void ConfigureEveryField(Metronome& metronome) {
  metronome.SetSounds(kTom, kHihatSound);
  metronome.SetTempo(87.0);
  metronome.SetTimeSignature(7, 8);
  metronome.SetSubdivision(3);
  metronome.SetSubdivisionAccents(3, 2);
  metronome.SetAccent(2, Accent::kMuted);
  metronome.SetPolyrhythm(true, 3);
  metronome.SetCountIn(1, true, kHihatSound);
  metronome.SetBarMute(true, 2, 1);
  metronome.SetRamp(true, 80.0, 120.0, 5.0, 2.0, kRampBars, false);
}

struct Twin {
  std::vector<float> left;
  std::vector<MetronomeView> views;
};

Twin RunTwin(bool with_rig) {
  Metronome metronome;
  ConfigureEveryField(metronome);
  Twin twin;
  auto on_block = [&metronome, with_rig](int64_t block) {
    if (with_rig && block == kRigOn) {
      metronome.rig_click().Start(kRig.bpm(), kRig.subdivision, kRigOn);
    }
    if (with_rig && block == kRigOff) metronome.rig_click().Stop();
    if (block == kMetronomeOn) metronome.StartAt(kMetronomeOn + kStartAtDelay);
  };
  auto after_block = [&metronome, &twin](int64_t end) {
    if (end == kRigOn || end == kRigMid || end == kMetronomeOn) {
      twin.views.push_back(View(metronome));
    }
  };
  twin.left = RenderLeft(metronome, kTwinFrames, on_block, after_block);
  return twin;
}

void TestMetronomeStateUntouched() {
  const Twin rig = RunTwin(true);
  const Twin plain = RunTwin(false);
  Check(
      rig.views.size() == 3 && rig.views[0] == rig.views[1] &&
          rig.views[1] == rig.views[2] && rig.views == plain.views,
      "rig click: every metronome getter reads the same before, during, after"
  );
  CheckCase(
      SameSamples(
          rig.left,
          kMetronomeOn,
          plain.left,
          kMetronomeOn,
          kTwinFrames - kMetronomeOn
      ),
      "rig click: a later metronome run is sample-identical to one with no rig",
      "pattern, tempo, transport, count-in, ramp or poly state changed"
  );
}

std::vector<float> MetronomeAfterRig(bool rig_first, bool* rig_active) {
  Metronome metronome;
  metronome.SetTempo(120.0);
  auto on_block = [&metronome, rig_first](int64_t block) {
    if (rig_first && block == kRigOn) {
      metronome.rig_click().Start(kRig.bpm(), kRig.subdivision, kRigOn);
    }
    if (block == kMetronomeOn) metronome.Start();
  };
  auto after_block = [&metronome, rig_active](int64_t end) {
    if (end > kMetronomeOn) *rig_active |= metronome.rig_click().is_active();
  };
  return RenderLeft(metronome, kTwinFrames, on_block, after_block);
}

void TestMetronomeStartStopsRig() {
  bool rig_active = false;
  const auto rig = MetronomeAfterRig(true, &rig_active);
  bool never = false;
  const auto plain = MetronomeAfterRig(false, &never);
  Check(!rig_active, "rig click: starting the metronome clears is_active");
  CheckCase(
      SameSamples(rig, kTailsGone, plain, kTailsGone, kTwinFrames - kTailsGone),
      "rig click: starting the metronome stops the rig ticks",
      "a rig tick sounded after the metronome started"
  );
}

std::vector<float> RigStartedDuring(bool start_at, bool rig, bool* active) {
  Metronome metronome;
  if (start_at) {
    metronome.StartAt(kTwinFrames);
  } else {
    metronome.Start();
  }
  auto on_block = [&metronome, rig](int64_t block) {
    if (rig && block == kRigOn) {
      metronome.rig_click().Start(kRig.bpm(), kRig.subdivision, kRigOn);
    }
  };
  auto after_block = [&metronome, active](int64_t) {
    *active |= metronome.rig_click().is_active();
  };
  return RenderLeft(metronome, kRigMid, on_block, after_block);
}

void TestRigRefusedWhileMetronomeStarted() {
  for (const bool start_at : {false, true}) {
    bool active = false;
    const auto rig = RigStartedDuring(start_at, true, &active);
    bool never = false;
    const auto plain = RigStartedDuring(start_at, false, &never);
    Check(
        !active && SameSamples(rig, 0, plain, 0, kRigMid),
        start_at ? "rig click: refused while a start_at is pending"
                 : "rig click: refused while the metronome runs"
    );
  }
}

}  // namespace

void RunRigClickIsolationTests() {
  TestMetronomeStateUntouched();
  TestMetronomeStartStopsRig();
  TestRigRefusedWhileMetronomeStarted();
}

}  // namespace metronome_test
