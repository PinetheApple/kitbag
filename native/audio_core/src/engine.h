#ifndef KITBAG_ENGINE_H
#define KITBAG_ENGINE_H

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <thread>

#include "media/decoder.h"
#include "metronome/metronome.h"
#include "miniaudio.h"
#include "mixer/mixer.h"
#include "player/player.h"
#include "tuner/tuner.h"

namespace kitbag {

class StallDetector;

// Realtime audio engine. Owns the output device; the data callback is the
// realtime thread — everything it touches must stay lock- and allocation-free.
class Engine {
 public:
  static constexpr uint32_t kSampleRate = 48000;
  static constexpr uint32_t kChannelCount = 2;
  static constexpr uint32_t kDefaultIdleGraceMs = 2000;

  Engine() = default;
  ~Engine();

  Engine(const Engine&) = delete;
  Engine& operator=(const Engine&) = delete;

  bool Init();
  bool Start();
  void Stop();
  bool Hold();
  void Release();
  void ResetHolders();
  int32_t holders() const;
  bool idle() const;
  void SetMetronomeIntent(bool playing) {
    metronome_intent_.store(playing);
  }
  void SetMixerIntent(bool playing) {
    mixer_intent_.store(playing);
  }
  void SetRigClickIntent(bool playing) {
    rig_click_intent_.store(playing);
  }
  bool rig_click_intent() const {
    return rig_click_intent_.load();
  }
  bool metronome_intent() const {
    return metronome_intent_.load();
  }
  void set_idle_grace_ms(uint32_t grace_ms) {
    idle_grace_ms_.store(grace_ms, std::memory_order_relaxed);
  }

  uint32_t sample_rate() const {
    return kSampleRate;
  }
  // True whenever the data callback can run. RtPublisher::Publish reads this to
  // decide whether a retired payload can be freed at once.
  bool is_running() const {
    return device_running_.load(std::memory_order_acquire);
  }
  uint64_t frames_rendered() const {
    return frames_rendered_.load(std::memory_order_relaxed);
  }

  // App thread, before any load: read-ahead for callbacks up to [frames] wide.
  void ReserveCallbackFrames(uint32_t frames) {
    mixer_.ReserveCallbackFrames(frames);
    player_.ReserveCallbackFrames(frames);
  }

  // Offline pull backing kb_engine_render; see its contract in kitbag_api.h.
  void RenderOffline(float* output, uint32_t frame_count) {
    Render(output, frame_count);
  }

  Metronome& metronome() {
    return metronome_;
  }
  const Metronome& metronome() const {
    return metronome_;
  }

  Tuner& tuner() {
    return tuner_;
  }
  const Tuner& tuner() const {
    return tuner_;
  }

  Decoder& decoder() {
    return decoder_;
  }
  const Decoder& decoder() const {
    return decoder_;
  }

  Mixer& mixer() {
    return mixer_;
  }
  const Mixer& mixer() const {
    return mixer_;
  }

  Player& player() {
    return player_;
  }
  const Player& player() const {
    return player_;
  }

 private:
  static void DataCallback(
      ma_device* device,
      void* output,
      const void* input,
      ma_uint32 frame_count
  );
  static void OnNotification(const ma_device_notification* notification);
  void Render(float* output, uint32_t frame_count);
  void RenderSlice(float* output, uint32_t frame_count);
  bool StartLocked();
  void StopDevice();
  void ReleaseRetired();
  bool IsIdle() const;
  void StartWatchdog();
  void StopWatchdog();
  void WatchOutput();
  bool WatchTick(StallDetector& stall, uint64_t* idle_since_ms);
  void RestartDevice();

  ma_device device_{};
  bool device_ready_ = false;

  std::atomic<bool> device_running_{false};
  std::atomic<uint64_t> frames_rendered_{0};

  // Restarts the device when its stream dies while the engine should be
  // playing: miniaudio gives up rerouting after a few attempts and never says.
  std::atomic<bool> restarting_{false};
  std::atomic<bool> stopped_unexpectedly_{false};
  std::thread watchdog_;
  std::mutex watchdog_mutex_;
  std::condition_variable watchdog_wake_;
  bool watchdog_exit_ = false;

  // Serializes device start/stop across control threads; the callback never
  // takes it. The watchdog only try-locks, so Stop can join it while holding.
  mutable std::mutex lifecycle_mutex_;
  int32_t holders_ = 0;
  std::atomic<bool> metronome_intent_{false};
  std::atomic<bool> mixer_intent_{false};
  std::atomic<bool> rig_click_intent_{false};
  std::atomic<uint32_t> idle_grace_ms_{kDefaultIdleGraceMs};

  Metronome metronome_;
  Tuner tuner_;
  Decoder decoder_;
  Mixer mixer_{kSampleRate};
  Player player_{kSampleRate};
};

}  // namespace kitbag

#endif  // KITBAG_ENGINE_H
