// The realtime half of the player: the command drain and the per-block mix. Runs
// entirely on the audio callback — allocates nothing, takes no lock, frees
// nothing. Setup and transport live in player.cpp.
#include <algorithm>

#include "player/player.h"

namespace kitbag {

// The exhaustive switch has no `default:` on purpose; see the ApplyCommand
// declaration in player.h.
void Player::ApplyCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kPlay:
      playing_.store(true, std::memory_order_relaxed);
      return;
    case CommandType::kPause:
      playing_.store(false, std::memory_order_relaxed);
      return;
    case CommandType::kSeek:
      read_frame_.store(command.frame, std::memory_order_relaxed);
      return;
  }
}

void Player::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) ApplyCommand(command);
}

void Player::MixMono(const float* src, float* output, uint32_t frames) {
  for (uint32_t f = 0; f < frames; ++f) {
    output[2 * f] += src[f];
    output[2 * f + 1] += src[f];
  }
}

void Player::MixStereo(
    const float* src,
    uint32_t channels,
    float* output,
    uint32_t frames
) {
  for (uint32_t f = 0; f < frames; ++f) {
    output[2 * f] += src[f * channels];
    output[2 * f + 1] += src[f * channels + 1];
  }
}

void Player::MixInto(
    const PlayerSource& src,
    float* output,
    uint32_t frame_count
) {
  const uint32_t got = src.source->Read(scratch_.data(), frame_count);
  if (src.channels == 1) {
    MixMono(scratch_.data(), output, got);
  } else if (src.channels >= 2) {
    MixStereo(scratch_.data(), src.channels, output, got);
  }
}

void Player::AdvanceTransport(uint64_t start_frame, uint32_t frame_count) {
  const uint64_t total = num_frames_.load(std::memory_order_relaxed);
  if (start_frame >= total) {
    playing_.store(false, std::memory_order_relaxed);
    return;
  }
  const uint64_t remaining = total - start_frame;
  read_frame_.store(
      start_frame + std::min(static_cast<uint64_t>(frame_count), remaining),
      std::memory_order_relaxed
  );
}

void Player::Render(float* output, uint32_t frame_count) {
  // Drain first so a seek/pause applies this block even while paused, and so
  // read_frame_ is written only from here.
  ApplyPendingCommands();
  // Scratch is sized to kMaxBlockFrames at setup; a wider block cannot be
  // drained without allocating, which the callback must never do.
  if (frame_count > kMaxBlockFrames) return;
  if (!playing_.load(std::memory_order_relaxed)) return;

  const uint64_t start_frame = read_frame_.load(std::memory_order_relaxed);
  // One acquire load carries the source and its identity; the old source is
  // never freed here, only off-thread once the clock moves past it.
  const auto* node = published_.Get();
  if (node != nullptr) MixInto(node->value, output, frame_count);
  AdvanceTransport(start_frame, frame_count);
}

}  // namespace kitbag
