#include "kitbag_api.h"

#include <chrono>
#include <thread>

#include "abi_test_engine_hold.h"
#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr int kIterations = 2000;

void HoldAndPlayMetronome(kb_engine* engine) {
  for (int i = 0; i < kIterations; ++i) {
    kb_engine_hold(engine);
    kb_metronome_start(engine);
    kb_engine_start(engine);
    kb_metronome_stop(engine);
    kb_engine_release(engine);
  }
}

void HoldAndPlayMixer(kb_engine* engine) {
  for (int i = 0; i < kIterations; ++i) {
    kb_engine_hold(engine);
    kb_mixer_play(engine);
    kb_engine_release(engine);
    kb_mixer_pause(engine);
  }
}

void RawStartStop(kb_engine* engine) {
  for (int i = 0; i < kIterations; ++i) {
    kb_engine_start(engine);
    kb_engine_stop(engine);
  }
}

void AwaitTwoBlocks(const kb_engine* engine, Clock::time_point deadline) {
  for (int blocks = 0; blocks < 2 && Clock::now() < deadline; ++blocks) {
    const uint64_t from = kb_engine_frames_rendered(engine);
    while (kb_engine_frames_rendered(engine) == from &&
           Clock::now() < deadline) {
      std::this_thread::sleep_for(kPoll);
    }
  }
}

// The threads outpace the callback, so a full ring may have dropped their last
// stop; resend until a drained block shows both stopped.
void SettleStopped(kb_engine* engine) {
  const Clock::time_point deadline = Clock::now() + kStopWithin;
  do {
    kb_metronome_stop(engine);
    kb_mixer_pause(engine);
    AwaitTwoBlocks(engine, deadline);
  } while ((kb_metronome_is_running(engine) == 1 ||
            kb_mixer_is_playing(engine) == 1) &&
           Clock::now() < deadline);
}

void CheckSettledState(kb_engine* engine) {
  Check(kb_engine_holders(engine) == 0, "stress: holds and releases balance");
  Check(
      kb_engine_hold(engine) == KB_OK && kb_engine_device_running(engine) == 1,
      "stress: a hold afterwards starts the device"
  );
  SettleStopped(engine);
  kb_engine_release(engine);
  Check(StopsWithin(engine), "stress: then idles out with nothing playing");
  kb_metronome_start(engine);
  kb_engine_start(engine);
  std::this_thread::sleep_for(kSeveralWatchTicks);
  Check(
      kb_engine_device_running(engine) == 1,
      "stress: a Play afterwards keeps the device with no holder"
  );
}

}  // namespace

void RunEngineLifecycleStress() {
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "stress: an engine is created");
  if (engine == nullptr) return;
  kb_engine_set_idle_grace_ms(engine, 0);
  std::thread metronome(HoldAndPlayMetronome, engine);
  std::thread mixer(HoldAndPlayMixer, engine);
  std::thread raw(RawStartStop, engine);
  metronome.join();
  mixer.join();
  raw.join();
  CheckSettledState(engine);
  kb_engine_destroy(engine);
}

}  // namespace abi_test
