// The realtime half of the player: the command drain and the per-block mix. Runs
// entirely on the audio callback — allocates nothing, takes no lock, frees
// nothing. Setup and transport live in player.cpp and StreamingTrack.
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

void Player::AdvanceTransport(uint64_t start_frame, uint32_t frame_count) {
  const uint64_t total = stream_.frames();
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
  // Scratch is sized to kMaxBlockFrames at setup; a wider block cannot be drained
  // without allocating, which the callback must never do.
  if (frame_count > StreamingTrack::kMaxBlockFrames) return;
  if (!playing_.load(std::memory_order_relaxed)) return;

  const uint64_t start_frame = read_frame_.load(std::memory_order_relaxed);
  uint32_t channels = 0;
  const uint32_t got =
      stream_.DrainBlock(scratch_.data(), frame_count, &channels);
  StreamingTrack::AddToOutput(scratch_.data(), channels, got, output, 1.0f);
  AdvanceTransport(start_frame, frame_count);
}

}  // namespace kitbag
