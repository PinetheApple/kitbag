#include "kitbag_api.h"

#include <cmath>
#include <limits>
#include <thread>

#include "abi_test_engine_hold.h"
#include "abi_test_metronome.h"
#include "abi_test_render.h"
#include "check.h"
#include "metronome/metronome.h"

namespace abi_test {
namespace {

using kitbag::Metronome;
using kitbag_test::Check;

constexpr double kRigBpm = 100.0;
constexpr int32_t kRigSubdivision = 1;
constexpr uint32_t kBlock = 256;
constexpr double kInfinity = std::numeric_limits<double>::infinity();

kb_result StartRig(kb_engine* engine, double bpm, int32_t subdivision) {
  return kb_rig_click_start(engine, bpm, subdivision, 0);
}

bool Active(kb_engine* engine) {
  Render(engine, kBlock);
  return kb_rig_click_is_active(engine) == 1;
}

void TestBoundsRejected(kb_engine* engine) {
  const double below = std::nextafter(kitbag::kMinBpm, 0.0);
  const double above = std::nextafter(kitbag::kMaxBpm, kInfinity);
  Check(
      StartRig(engine, below, 1) == KB_ERROR_INVALID_ARGUMENT &&
          StartRig(engine, above, 1) == KB_ERROR_INVALID_ARGUMENT &&
          StartRig(engine, std::nan(""), 1) == KB_ERROR_INVALID_ARGUMENT &&
          StartRig(engine, kInfinity, 1) == KB_ERROR_INVALID_ARGUMENT,
      "rig click: bpm outside the metronome range or non-finite is rejected"
  );
  Check(
      StartRig(engine, kRigBpm, Metronome::kMinSubdivision - 1) ==
              KB_ERROR_INVALID_ARGUMENT &&
          StartRig(engine, kRigBpm, Metronome::kMaxSubdivision + 1) ==
              KB_ERROR_INVALID_ARGUMENT,
      "rig click: subdivision outside the metronome range is rejected"
  );
  Check(
      kb_rig_click_start(engine, kRigBpm, 1, -1) == KB_ERROR_INVALID_ARGUMENT &&
          StartRig(nullptr, kRigBpm, 1) == KB_ERROR_INVALID_ARGUMENT,
      "rig click: a negative start_frame or a null engine is rejected"
  );
  Check(!Active(engine), "rig click: a rejected start changes nothing");
}

void TestBoundsAccepted(kb_engine* engine) {
  Check(
      StartRig(engine, kitbag::kMinBpm, Metronome::kMinSubdivision) == KB_OK &&
          Active(engine),
      "rig click: the slowest tempo and subdivision 1 are accepted"
  );
  Check(
      StartRig(engine, kitbag::kMaxBpm, Metronome::kMaxSubdivision) == KB_OK &&
          Active(engine),
      "rig click: the fastest tempo and top subdivision are accepted"
  );
  kb_rig_click_stop(engine);
  kb_rig_click_stop(nullptr);
  Check(
      !Active(engine) && kb_rig_click_is_active(nullptr) == 0,
      "rig click: stop clears is_active; null engines are no-ops"
  );
}

void TestBusyWhileMetronomeStarted(kb_engine* engine) {
  kb_metronome_start(engine);
  const kb_result queued = StartRig(engine, kRigBpm, kRigSubdivision);
  const bool active = Active(engine);
  const kb_result running = StartRig(engine, kRigBpm, kRigSubdivision);
  Check(
      queued == KB_ERROR_BUSY && running == KB_ERROR_BUSY && !active &&
          !Active(engine),
      "rig click: KB_ERROR_BUSY while the metronome is started, nothing runs"
  );
  kb_metronome_stop(engine);
  Render(engine, kBlock);
  Check(
      StartRig(engine, kRigBpm, kRigSubdivision) == KB_OK && Active(engine),
      "rig click: starts once the metronome has stopped"
  );
  kb_metronome_start(engine);
  Check(!Active(engine), "rig click: starting the metronome stops it");
  kb_metronome_stop(engine);
}

kb_engine* IdleEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_engine_set_idle_grace_ms(engine, 0);
  return engine;
}

void PlayRig(kb_engine* engine) {
  kb_rig_click_start(
      engine,
      kRigBpm,
      kRigSubdivision,
      static_cast<int64_t>(kb_engine_frames_rendered(engine))
  );
  kb_engine_start(engine);
}

bool StillRunning(const kb_engine* engine) {
  std::this_thread::sleep_for(kSeveralWatchTicks);
  return kb_engine_device_running(engine) == 1;
}

void TestIdleStop() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  PlayRig(engine);
  Check(
      StillRunning(engine),
      "rig click: idle stop never cuts a running click"
  );
  kb_rig_click_stop(engine);
  Check(
      StopsWithin(engine),
      "rig click: stopping it lets the idle stop happen"
  );
  PlayRig(engine);
  kb_metronome_start(engine);
  kb_metronome_stop(engine);
  Check(
      StopsWithin(engine),
      "rig click: a metronome start takes over its play intent"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunRigClickAbiTests() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  TestBoundsRejected(engine);
  TestBoundsAccepted(engine);
  TestBusyWhileMetronomeStarted(engine);
  kb_engine_destroy(engine);
  TestIdleStop();
}

}  // namespace abi_test
