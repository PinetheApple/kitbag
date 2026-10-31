#include "metronome/rig_click.h"

#include <cmath>

#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::kSecondsPerMinute;

namespace {

// A decimal tempo is inexact in binary, so a quotient that is whole can compute
// a hair above it; far below the spacing of a real fractional part.
constexpr double kWholeFrameTolerance = 1e-6;

}  // namespace

bool RigClick::Start(double bpm, int subdivision, uint64_t start_frame) {
  return commands_.Push({
      .bpm = bpm,
      .subdivision = subdivision,
      .frame = start_frame,
      .stop_epoch = stop_epoch_.load(std::memory_order_relaxed),
  });
}

void RigClick::Stop() {
  stop_epoch_.fetch_add(1, std::memory_order_release);
}

void RigClick::BeginBlock(
    uint64_t block_start_frame,
    uint32_t sample_rate,
    bool metronome_started
) {
  StartCommand command;
  while (commands_.Pop(&command)) {
    Arm(command, block_start_frame, sample_rate);
  }
  // Loaded after the drain, so every popped start's epoch is at most this one.
  const uint32_t stop_epoch = stop_epoch_.load(std::memory_order_acquire);
  if (metronome_started || armed_epoch_ != stop_epoch) active_ = false;
  active_flag_.store(active_, std::memory_order_relaxed);
}

void RigClick::Arm(
    const StartCommand& command,
    uint64_t block_start_frame,
    uint32_t sample_rate
) {
  active_ = true;
  armed_epoch_ = command.stop_epoch;
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
      static_cast<double>(tick) * frames_per_minute_ / ticks_per_minute_ -
      kWholeFrameTolerance
  );
  return start_frame_ + static_cast<uint64_t>(offset);
}

int RigClick::ConsumeTickAt(uint64_t frame) {
  if (!active_ || frame < next_tick_frame_) return kNoTick;
  const auto slot = static_cast<int>(next_tick_ % subdivision_);
  ++next_tick_;
  next_tick_frame_ = FrameOfTick(next_tick_);
  return slot;
}

}  // namespace kitbag
