#include <utility>

#include "mixer/mixer.h"

namespace kitbag {

void Mixer::StartStreams() {
  app_playing_ = true;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StartAndPrime();
}

void Mixer::StopStreams() {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopSource();
}

bool Mixer::track_reading(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return false;
  }
  return tracks_[track].stream->reading();
}

bool Mixer::PlayAt(uint64_t engine_frame) {
  const bool was_playing = app_playing_;
  StartStreams();
  Command command{CommandType::kPlayAt};
  command.frame = engine_frame;
  if (Enqueue(command)) return true;
  app_playing_ = was_playing;
  if (!was_playing) StopStreams();
  return false;
}

// The last transport command wins, so each one replaces a pending start.
void Mixer::ApplyTransportCommand(const Command& command) {
  pending_play_frame_.reset();
  if (command.type == CommandType::kPlayAt) pending_play_frame_ = command.frame;
  playing_.store(command.type == CommandType::kPlay, std::memory_order_relaxed);
}

uint32_t
Mixer::StartPendingPlay(uint64_t block_start_frame, uint32_t frame_count) {
  if (!pending_play_frame_ ||
      *pending_play_frame_ >= block_start_frame + frame_count) {
    return 0;
  }
  const uint64_t at = *std::exchange(pending_play_frame_, std::nullopt);
  playing_.store(true, std::memory_order_relaxed);
  return at > block_start_frame ? static_cast<uint32_t>(at - block_start_frame)
                                : 0;
}

}  // namespace kitbag
