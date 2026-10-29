#include "engine.h"

#include <algorithm>
#include <chrono>

#include "rt/stall_detector.h"

namespace kitbag {

namespace {

// A started stream renders every few ms; 1.5 s of nothing is a dead stream,
// and outlasts miniaudio's own reroute so the two do not race.
constexpr std::chrono::milliseconds kStallAfter{1500};
constexpr std::chrono::milliseconds kWatchEvery{250};

uint64_t NowMs() {
  return static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::steady_clock::now().time_since_epoch()
      )
          .count()
  );
}

}  // namespace

Engine::~Engine() {
  Stop();
  if (device_ready_) {
    ma_device_uninit(&device_);
  }
}

bool Engine::Init() {
  ma_device_config config = ma_device_config_init(ma_device_type_playback);
  config.playback.format = ma_format_f32;
  config.playback.channels = kChannelCount;
  config.sampleRate = kSampleRate;
  config.dataCallback = DataCallback;
  config.notificationCallback = OnNotification;
  config.pUserData = this;

  if (ma_device_init(nullptr, &config, &device_) != MA_SUCCESS) {
    return false;
  }
  device_ready_ = true;
  // Fixed-size callbacks (the miniaudio default) are exactly this wide; a later
  // reroute keeps this width but may widen the backend period (decisions.md).
  ReserveCallbackFrames(device_.playback.intermediaryBufferCap);
  return true;
}

bool Engine::Start() {
  if (!device_ready_) {
    return false;
  }
  const bool started = ma_device_start(&device_) == MA_SUCCESS;
  // Set only after the device is live, so a publisher that reads this can never
  // conclude "no reader" while the callback is already running.
  device_running_.store(started, std::memory_order_relaxed);
  if (started) {
    StartWatchdog();
  }
  return started;
}

void Engine::Stop() {
  StopWatchdog();
  if (device_ready_) {
    restarting_.store(true, std::memory_order_relaxed);
    ma_device_stop(&device_);
  }
  // ma_device_stop blocks until the callback has returned, so from here on
  // there is no reader.
  device_running_.store(false, std::memory_order_relaxed);
  restarting_.store(false, std::memory_order_relaxed);
  // Nothing else ever reclaims these: Collect only frees as frames_rendered_
  // moves, and a stopped engine never moves it.
  metronome_.ReleaseRetiredGrids();
  mixer_.ReleaseRetiredSources();
  player_.ReleaseRetiredSources();
}

void Engine::OnNotification(const ma_device_notification* notification) {
  auto* engine = static_cast<Engine*>(notification->pDevice->pUserData);
  if (notification->type != ma_device_notification_type_stopped ||
      engine->restarting_.load(std::memory_order_relaxed)) {
    return;
  }
  // The device cannot be restarted from inside its own notification.
  engine->stopped_unexpectedly_.store(true, std::memory_order_relaxed);
  engine->watchdog_wake_.notify_one();
}

void Engine::StartWatchdog() {
  if (watchdog_.joinable()) {
    return;
  }
  {
    const std::lock_guard<std::mutex> lock(watchdog_mutex_);
    watchdog_exit_ = false;
  }
  watchdog_ = std::thread([this] { WatchOutput(); });
}

void Engine::StopWatchdog() {
  if (!watchdog_.joinable()) {
    return;
  }
  {
    const std::lock_guard<std::mutex> lock(watchdog_mutex_);
    watchdog_exit_ = true;
  }
  watchdog_wake_.notify_one();
  watchdog_.join();
}

void Engine::WatchOutput() {
  StallDetector stall(static_cast<uint64_t>(kStallAfter.count()));
  stall.Reset(frames_rendered(), NowMs());
  std::unique_lock<std::mutex> lock(watchdog_mutex_);
  while (!watchdog_exit_) {
    watchdog_wake_.wait_for(lock, kWatchEvery);
    if (watchdog_exit_) {
      break;
    }
    const bool stopped =
        stopped_unexpectedly_.exchange(false, std::memory_order_relaxed);
    if (stopped || stall.Observe(frames_rendered(), NowMs())) {
      lock.unlock();
      RestartDevice();
      stall.Reset(frames_rendered(), NowMs());
      lock.lock();
    }
  }
}

// Same clock: frames_rendered_ carries on, so the metronome's schedule and
// anchors stay valid and the click resumes where the song is.
void Engine::RestartDevice() {
  restarting_.store(true, std::memory_order_relaxed);
  ma_device_stop(&device_);
  restarting_.store(false, std::memory_order_relaxed);
  const bool started = ma_device_start(&device_) == MA_SUCCESS;
  device_running_.store(started, std::memory_order_relaxed);
}

void Engine::DataCallback(
    ma_device* device,
    void* output,
    const void* input,
    ma_uint32 frame_count
) {
  (void)input;
  auto* engine = static_cast<Engine*>(device->pUserData);
  engine->Render(static_cast<float*>(output), frame_count);
}

// Scratch covers kMaxBlockFrames; the read-ahead behind it is sized for the
// whole callback (ReserveCallbackFrames), so slicing never outruns a ring.
void Engine::Render(float* output, uint32_t frame_count) {
  while (frame_count > 0) {
    const uint32_t slice =
        std::min(frame_count, StreamingTrack::kMaxBlockFrames);
    RenderSlice(output, slice);
    output += static_cast<size_t>(slice) * kChannelCount;
    frame_count -= slice;
  }
}

void Engine::RenderSlice(float* output, uint32_t frame_count) {
  // Engine-clock frame of output[0] — the transport metronome anchoring
  // (StartAt, grid anchors) is expressed against. Advanced once after the slice.
  const uint64_t block_start_frame =
      frames_rendered_.load(std::memory_order_relaxed);

  // Process clears the buffer (memset) and mixes the stems; the player and the
  // metronome then accumulate on top, so the three compose additively.
  mixer_.Process(output, frame_count);
  player_.Render(output, frame_count);

  metronome_.Render(
      output,
      frame_count,
      kSampleRate,
      kChannelCount,
      block_start_frame,
      &mixer_.song_clock()
  );

  frames_rendered_.fetch_add(frame_count, std::memory_order_relaxed);
}

}  // namespace kitbag
