#include "metronome/rig_click.h"

#include <cmath>

#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::kSecondsPerMinute;

bool RigClick::Start(double bpm, int subdivision, uint64_t start_frame) {
  Command command;
  command.start = true;
  command.bpm = bpm;
  command.subdivision = subdivision;
  command.frame = start_frame;
  return commands_.Push(command);
}

bool RigClick::Stop() {
  return commands_.Push(Command{});
}

void RigClick::BeginBlock(
    uint64_t block_start_frame,
    uint32_t sample_rate,
    bool metronome_started
) {
  Command command;
  while (commands_.Pop(&command)) {
    if (command.start && !metronome_started) {
      Arm(command, block_start_frame, sample_rate);
    } else {
      active_ = false;
    }
  }
  if (metronome_started) active_ = false;
  active_flag_.store(active_, std::memory_order_relaxed);
}

void RigClick::Arm(
    const Command& command,
    uint64_t block_start_frame,
    uint32_t sample_rate
) {
  active_ = true;
  subdivision_ = command.subdivision;
  start_frame_ = command.frame;
  frames_per_minute_ = kSecondsPerMinute * sample_rate;
  ticks_per_minute_ = command.bpm * command.subdivision;
  next_tick_ = FirstTickAtOrAfter(block_start_frame);
  next_tick_frame_ = FrameOfTick(next_tick_);
}

// The estimate can sit one tick either side of the answer through rounding.
int64_t RigClick::FirstTickAtOrAfter(uint64_t frame) const {
  if (frame <= start_frame_) return 0;
  const auto elapsed = static_cast<double>(frame - start_frame_);
  auto tick = static_cast<int64_t>(
      std::ceil(elapsed * ticks_per_minute_ / frames_per_minute_)
  );
  if (tick > 0 && FrameOfTick(tick - 1) >= frame) --tick;
  if (FrameOfTick(tick) < frame) ++tick;
  return tick;
}

uint64_t RigClick::FrameOfTick(int64_t tick) const {
  const double offset = std::ceil(
      static_cast<double>(tick) * frames_per_minute_ / ticks_per_minute_
  );
  return start_frame_ + static_cast<uint64_t>(offset);
}

int RigClick::TickAt(uint64_t frame) {
  if (!active_ || frame < next_tick_frame_) return kNoTick;
  const auto slot = static_cast<int>(next_tick_ % subdivision_);
  ++next_tick_;
  next_tick_frame_ = FrameOfTick(next_tick_);
  return slot;
}

}  // namespace kitbag
