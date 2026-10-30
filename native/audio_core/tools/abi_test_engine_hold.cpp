#include "kitbag_api.h"

#include "abi_test_engine_hold.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <functional>
#include <thread>
#include <vector>

#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint64_t kDeferredStartFrames = 48000 * 30;
constexpr int32_t kBeep = 0;
constexpr uint32_t kTailFrames = 4800;

kb_engine* IdleEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_engine_set_idle_grace_ms(engine, 0);
  return engine;
}

bool Running(const kb_engine* engine) {
  return kb_engine_device_running(engine) == 1;
}

bool StillRunningAfterTicks(const kb_engine* engine) {
  std::this_thread::sleep_for(kSeveralWatchTicks);
  return Running(engine);
}

void PlayMetronome(kb_engine* engine) {
  kb_metronome_start(engine);
  kb_engine_start(engine);
}

void TestHoldCounts() {
  kb_engine* engine = IdleEngine();
  Check(engine != nullptr, "hold: an engine is created");
  if (engine == nullptr) return;
  Check(kb_engine_hold(engine) == KB_OK, "hold: the first hold starts");
  kb_engine_hold(engine);
  Check(
      kb_engine_holders(engine) == 2 && Running(engine),
      "hold: two holds count two and the device is started"
  );
  kb_engine_release(engine);
  Check(kb_engine_holders(engine) == 1, "hold: a release closes one holder");
  kb_engine_release(engine);
  kb_engine_release(engine);
  Check(kb_engine_holders(engine) == 0, "hold: a release past zero is ignored");
  Check(kb_engine_hold(nullptr) == KB_ERROR_INVALID_ARGUMENT, "hold: null");
  kb_engine_release(nullptr);
  kb_engine_destroy(engine);
}

void TestResetHoldersAfterReload() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_hold(engine);
  kb_engine_hold(engine);
  kb_engine_reset_holders(engine);
  kb_engine_reset_holders(nullptr);
  Check(
      kb_engine_holders(engine) == 0 && StopsWithin(engine),
      "reset: leaked holders close and the idle device stops"
  );
  kb_engine_destroy(engine);
}

void TestStopsOnlyWhenIdle() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_hold(engine);
  PlayMetronome(engine);
  kb_metronome_pause(engine);
  Check(
      StillRunningAfterTicks(engine),
      "idle: a pause with a holder open keeps the device"
  );
  kb_engine_release(engine);
  Check(
      StopsWithin(engine),
      "idle: the last release with nothing playing stops the device"
  );
  kb_engine_destroy(engine);
}

void TestDefaultGraceOutlastsChurn() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  kb_engine_hold(engine);
  kb_engine_release(engine);
  Check(
      StillRunningAfterTicks(engine),
      "idle: the default grace keeps the device across a quick re-hold"
  );
  kb_engine_destroy(engine);
}

void TestPlayingOutlivesRelease(
    const std::function<void(kb_engine*)>& play,
    const std::function<void(kb_engine*)>& halt,
    const char* kept,
    const char* stopped
) {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_hold(engine);
  play(engine);
  kb_engine_release(engine);
  Check(StillRunningAfterTicks(engine), kept);
  halt(engine);
  Check(StopsWithin(engine), stopped);
  kb_engine_destroy(engine);
}

void TestReleaseWhilePlaying() {
  TestPlayingOutlivesRelease(
      PlayMetronome,
      kb_metronome_stop,
      "intent: a release while the metronome plays keeps the device",
      "intent: stopping the metronome with no holder stops the device"
  );
  TestPlayingOutlivesRelease(
      [](kb_engine* engine) {
        kb_mixer_play(engine);
        kb_engine_start(engine);
      },
      kb_mixer_pause,
      "intent: a release while the mixer plays keeps the device",
      "intent: pausing the mixer with no holder stops the device"
  );
}

// Notification Play lands between a pause and JS's late release of the screen;
// a start far ahead keeps the mirror stopped, so only the intent can hold.
void TestStaleReleaseAfterNotificationPlay() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_hold(engine);
  PlayMetronome(engine);
  kb_metronome_pause(engine);
  kb_metronome_start_at(
      engine,
      kb_engine_frames_rendered(engine) + kDeferredStartFrames
  );
  kb_engine_start(engine);
  kb_engine_release(engine);
  Check(
      StillRunningAfterTicks(engine) && kb_metronome_is_running(engine) == 0,
      "stale release: a queued Play keeps the device"
  );
  kb_engine_destroy(engine);
}

void TestPlayRestartsIdleDevice() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_hold(engine);
  kb_mixer_play(engine);
  kb_mixer_pause(engine);
  kb_engine_release(engine);
  Check(StopsWithin(engine), "restart: the idle device stops");
  PlayMetronome(engine);
  Check(
      StillRunningAfterTicks(engine),
      "restart: a later Play restarts the device and keeps it"
  );
  kb_engine_destroy(engine);
}

void AwaitBlockAfter(const kb_engine* engine, uint64_t frame) {
  const Clock::time_point deadline = Clock::now() + kStopWithin;
  while (kb_engine_frames_rendered(engine) <= frame &&
         Clock::now() < deadline) {
    std::this_thread::yield();
  }
}

// The click outlives the device: a voice still ringing at the stop sounds in
// the next offline pull, so the pull shows whether the callback played it.
double TailPeakAfterStop(kb_engine* engine) {
  kb_engine_stop(engine);
  std::vector<float> tail(static_cast<size_t>(kTailFrames) * 2);
  kb_engine_render(engine, tail.data(), kTailFrames);
  double peak = 0.0;
  for (const float sample : tail) {
    peak = std::max(peak, static_cast<double>(std::fabs(sample)));
  }
  return peak;
}

void TestPreviewIssuedWhileRunning() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_engine_start(engine);
  const uint64_t issued = kb_engine_frames_rendered(engine);
  kb_metronome_preview_sound(engine, kBeep, 0);
  AwaitBlockAfter(engine, issued);
  Check(
      TailPeakAfterStop(engine) > 0.0,
      "preview: one issued while running rings past the stop"
  );
  kb_engine_destroy(engine);
}

void TestPreviewQueuedWhileStopped() {
  kb_engine* engine = IdleEngine();
  if (engine == nullptr) return;
  kb_metronome_preview_sound(engine, kBeep, 0);
  kb_engine_start(engine);
  AwaitBlockAfter(engine, kb_engine_frames_rendered(engine));
  Check(
      TailPeakAfterStop(engine) == 0.0,
      "preview: one queued while stopped is dropped when the device starts"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunEngineHoldAbiTests() {
  TestHoldCounts();
  TestResetHoldersAfterReload();
  TestStopsOnlyWhenIdle();
  TestDefaultGraceOutlastsChurn();
  TestReleaseWhilePlaying();
  TestStaleReleaseAfterNotificationPlay();
  TestPlayRestartsIdleDevice();
  TestPreviewIssuedWhileRunning();
  TestPreviewQueuedWhileStopped();
  RunEngineLifecycleStress();
}

}  // namespace abi_test
