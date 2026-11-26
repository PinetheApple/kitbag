#ifndef KITBAG_ENGINE_H
#define KITBAG_ENGINE_H

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <thread>

#include "kitbag_engine_hold_api.h"
#include "kitbag_metronome_slot_api.h"
#include "media/decoder.h"
#include "metronome/metronome.h"
#include "miniaudio.h"
#include "mixdown/mixdown_job.h"
#include "mixer/mixer.h"
#include "player/player.h"
#include "rt/clock_pair_mirror.h"
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
  static constexpr int32_t kMetronomeSlots = KB_METRONOME_SLOT_PLAY_ALONG + 1;

  static bool ValidMetronomeSlot(int32_t slot) {
    return slot >= 0 && slot < kMetronomeSlots;
  }

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
  void SelectMetronomeSlot(int32_t slot) {
    if (ValidMetronomeSlot(slot)) selected_slot_.store(slot);
  }
  int32_t selected_metronome_slot() const {
    return selected_slot_.load();
  }
  void SetMetronomeIntent(int32_t slot, bool playing) {
    if (playing) {
      ClaimMetronomeIntent(slot);
    } else {
      metronome_intents_[slot].store(Metronome::kNoIntent);
    }
  }
  // A fresh token per claim, so a count's end clears only the intent it set.
  uint32_t ClaimMetronomeIntent(int32_t slot) {
    uint32_t token = intent_tokens_.fetch_add(1) + 1;
    if (token == Metronome::kNoIntent) token = intent_tokens_.fetch_add(1) + 1;
    metronome_intents_[slot].store(token);
    return token;
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
    return metronome_intents_[selected_metronome_slot()].load() !=
           Metronome::kNoIntent;
  }
  bool mixer_intent() const {
    return mixer_intent_.load();
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
    return frame_clock().Now();
  }
  FrameClock frame_clock() const {
    return FrameClock::Reading(frames_rendered_);
  }
  bool ReadRenderClock(ClockPair* out) const {
    return render_clock_.Read(out);
  }
  bool FrameAtBoottime(int64_t boottime_ns, int64_t* out_frame) const;

  int32_t OutputDeviceId() const;

  // App thread, before any load: read-ahead for callbacks up to [frames] wide.
  void ReserveCallbackFrames(uint32_t frames) {
    mixer_.ReserveCallbackFrames(frames);
    player_.ReserveCallbackFrames(frames);
  }

  // Offline pull backing kb_engine_render; see its contract in kitbag_api.h.
  void
  RenderOffline(float* output, uint32_t frame_count, int64_t monotonic_ns) {
    Render(output, frame_count, monotonic_ns);
  }

  Metronome& metronome() {
    return metronomes_[selected_metronome_slot()];
  }
  const Metronome& metronome() const {
    return metronomes_[selected_metronome_slot()];
  }
  Metronome& metronome(int32_t slot) {
    return metronomes_[slot];
  }
  const Metronome& metronome(int32_t slot) const {
    return metronomes_[slot];
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

  MixdownJob& mixdown() {
    return mixdown_;
  }
  const MixdownJob& mixdown() const {
    return mixdown_;
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
  void Render(float* output, uint32_t frame_count, int64_t monotonic_ns);
  void RenderSlice(float* output, uint32_t frame_count);
  void RenderMetronome(
      int32_t slot,
      bool selected,
      float* output,
      uint32_t frame_count,
      uint64_t block_start_frame
  );
  bool StartLocked();
  void StopDevice();
  void ReleaseRetired();
  bool IsIdle() const;
  void StartWatchdog();
  void StopWatchdog();
  void WatchOutput();
  bool WatchTick(StallDetector& stall, uint64_t* idle_since_ms);
  void RestartDevice();
  void ResolveDeviceIdReader();
  void RefreshOutputDeviceId();

  ma_device device_{};
  bool device_ready_ = false;

  using AAudioDeviceIdFn = int32_t (*)(struct AAudioStreamStruct*);
  AAudioDeviceIdFn aaudio_device_id_ = nullptr;
  std::atomic<int32_t> output_device_id_{KB_NO_OUTPUT_DEVICE_ID};

  std::atomic<bool> device_running_{false};
  std::atomic<uint64_t> frames_rendered_{0};
  ClockPairMirror render_clock_;

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
  std::atomic<int32_t> selected_slot_{KB_METRONOME_SLOT_STANDALONE};
  std::atomic<uint32_t> metronome_intents_[kMetronomeSlots] = {};
  std::atomic<uint32_t> intent_tokens_{Metronome::kNoIntent};
  std::atomic<bool> mixer_intent_{false};
  std::atomic<bool> rig_click_intent_{false};
  std::atomic<uint32_t> idle_grace_ms_{kDefaultIdleGraceMs};

  Metronome metronomes_[kMetronomeSlots];
  Tuner tuner_;
  Decoder decoder_;
  Mixer mixer_{kSampleRate};
  Player player_{kSampleRate};
  // Last, so it is destroyed first: the render is cancelled and joined.
  MixdownJob mixdown_{kSampleRate};
};

static_assert(
    kCustomSoundRate == Engine::kSampleRate,
    "custom sounds are prepared and faded at the engine rate"
);

}  // namespace kitbag

#endif  // KITBAG_ENGINE_H
