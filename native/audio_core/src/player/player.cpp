// App-thread transport for the player. Setup, off-thread publish and the #25
// rebuild-and-swap seek all live in StreamingTrack; the realtime drain and mix
// live in player_render.cpp.
#include "player/player.h"

namespace kitbag {

void Player::Enqueue(const Command& command) {
  if (!commands_.Push(command)) ++dropped_commands_;
}

void Player::Play() {
  stream_.StartAndPrime();
  Enqueue({CommandType::kPlay});
}

void Player::Pause() {
  Enqueue({CommandType::kPause});
  stream_.StopSource();
}

void Player::Seek(uint64_t frame, FrameClock clock, bool engine_running) {
  // StreamingTrack::Seek returns false only when a live rebuild failed and the
  // old source was resumed in place; suppress kSeek so the transport holds at the
  // audible position rather than jumping to the target (#25).
  if (!stream_.Seek(frame, clock, engine_running)) return;
  Command command{CommandType::kSeek};
  command.frame = frame;
  Enqueue(command);
}

}  // namespace kitbag
