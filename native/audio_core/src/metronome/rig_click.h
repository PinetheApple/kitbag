#ifndef KITBAG_METRONOME_RIG_CLICK_H
#define KITBAG_METRONOME_RIG_CLICK_H

#include <atomic>
#include <cstddef>
#include <cstdint>

#include "rt/spsc_ring.h"

namespace kitbag {

// Settings' test click: a tick schedule on the engine frame clock and nothing
// else. The Metronome owns the voices, volume and accent table it sounds with.
class RigClick {
 public:
  static constexpr int kNoTick = -1;

  // App thread. Start is false when the ring is full.
  bool Start(double bpm, int subdivision, uint64_t start_frame);
  void Stop();

  bool is_active() const {
    return active_flag_.load(std::memory_order_relaxed);
  }

  // RT: drains commands; `metronome_started` stops the click and refuses starts.
  void BeginBlock(
      uint64_t block_start_frame,
      uint32_t sample_rate,
      bool metronome_started
  );
  // RT: consumes the tick due on `frame` and returns its slot, or kNoTick.
  int ConsumeTickAt(uint64_t frame);
  int subdivision() const {
    return subdivision_;
  }

 private:
  struct StartCommand {
    double bpm = 0.0;
    int32_t subdivision = 0;
    uint64_t frame = 0;
    uint32_t stop_epoch = 0;
  };

  static constexpr size_t kCommandRingSize = 16;

  void Arm(
      const StartCommand& command,
      uint64_t block_start_frame,
      uint32_t sample_rate
  );
  int64_t FirstTickAtOrAfter(uint64_t frame) const;
  uint64_t FrameOfTick(int64_t tick) const;

  SpscRing<StartCommand, kCommandRingSize> commands_;
  // Bumped by every Stop; a start survives only if no stop followed its push.
  std::atomic<uint32_t> stop_epoch_{0};

  bool active_ = false;
  uint32_t armed_epoch_ = 0;
  int subdivision_ = 1;
  uint64_t start_frame_ = 0;
  double frames_per_minute_ = 0.0;
  double ticks_per_minute_ = 1.0;
  int64_t next_tick_ = 0;
  uint64_t next_tick_frame_ = 0;

  std::atomic<bool> active_flag_{false};
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_RIG_CLICK_H
