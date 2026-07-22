// Setup, off-thread publish, transport, and getters. The realtime drain and mix
// live in player_render.cpp.
#include "player/player.h"

#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>

#include "media/file_audio_reader.h"
#include "media/resampling_source_reader.h"

namespace kitbag {
namespace {

// How far ahead the setup path buffers before playback, and inside the source
// ring so it is always reachable. Mirrors the mixer's prime window.
constexpr uint64_t kPrimeAheadFrames = Player::kMaxBlockFrames;
constexpr auto kPrimeTimeout = std::chrono::seconds(2);
constexpr auto kPrimePoll = std::chrono::milliseconds(1);

}  // namespace

bool Player::BuildSource(PlayerSource& ps, SourceReader* base) {
  // Resample on load so the ring — and Render — only ever see engine-rate
  // frames (SPEC.md §4.1). num_frames is the resampled length.
  SourceReader* reader = base;
  const uint32_t rate = base->sample_rate();
  if (rate != 0 && rate != engine_rate_) {
    auto rs = std::make_unique<ResamplingSourceReader>(base, engine_rate_);
    if (!rs->ok()) return false;
    ps.resampler = std::move(rs);
    reader = ps.resampler.get();
  }
  ps.channels = reader->channels();
  // scratch_ is sized to kMaxChannels at construction and never grows, so a
  // wider source would overrun it under a concurrent Render. Reject at load.
  if (ps.channels == 0 || ps.channels > kMaxChannels) return false;
  ps.num_frames = reader->total_frames();
  ps.source = std::make_unique<AudioSource>();
  return ps.source->Open(reader);
}

void Player::Publish(
    std::unique_ptr<PlayerSource> ps,
    uint64_t now_frame,
    bool engine_running
) {
  // The source pointee survives the move into the publisher node, so this raw
  // handle stays valid for the off-thread transport work.
  live_source_ = ps->source.get();
  live_num_frames_ = ps->num_frames;
  num_frames_.store(ps->num_frames, std::memory_order_relaxed);
  published_.Publish(std::move(ps), now_frame, engine_running);
}

bool Player::Load(const char* path, uint64_t now_frame, bool engine_running) {
  if (path == nullptr) return false;
  auto reader = std::make_unique<FileAudioReader>();
  if (!reader->Open(path)) return false;
  auto ps = std::make_unique<PlayerSource>();
  if (!BuildSource(*ps, reader.get())) return false;
  ps->owned_reader = std::move(reader);
  load_path_ = path;
  Publish(std::move(ps), now_frame, engine_running);
  return true;
}

void Player::Unload(uint64_t now_frame, bool engine_running) {
  // Stop the read-ahead thread now; the node itself is reclaimed off the
  // callback by the publisher, so nothing is freed on the audio thread.
  if (live_source_ != nullptr) live_source_->Stop();
  live_source_ = nullptr;
  live_num_frames_ = 0;
  load_path_.clear();
  num_frames_.store(0, std::memory_order_relaxed);
  published_.Publish(nullptr, now_frame, engine_running);
}

bool Player::ready() const {
  return published_.Get() != nullptr;
}

void Player::Enqueue(const Command& command) {
  if (!commands_.Push(command)) ++dropped_commands_;
}

void Player::Prime(AudioSource& src, uint64_t num_frames) {
  const uint64_t pos = src.position();
  const uint64_t remaining = num_frames > pos ? num_frames - pos : 0;
  const uint64_t target = std::min(remaining, kPrimeAheadFrames);
  const auto deadline = std::chrono::steady_clock::now() + kPrimeTimeout;
  while (src.buffered_frames() < target && !src.is_at_end()) {
    if (std::chrono::steady_clock::now() > deadline) break;
    std::this_thread::sleep_for(kPrimePoll);
  }
}

void Player::Play() {
  if (live_source_ != nullptr) {
    if (!live_source_->is_running()) live_source_->Start();
    Prime(*live_source_, live_num_frames_);
  }
  Enqueue({CommandType::kPlay});
}

void Player::Pause() {
  Enqueue({CommandType::kPause});
  if (live_source_ != nullptr) live_source_->Stop();
}

std::unique_ptr<Player::PlayerSource> Player::BuildReseekSource(
    uint64_t target
) {
  if (load_path_.empty()) return nullptr;
  auto reader = std::make_unique<FileAudioReader>();
  if (!reader->Open(load_path_.c_str())) return nullptr;
  auto ps = std::make_unique<PlayerSource>();
  if (!BuildSource(*ps, reader.get())) return nullptr;
  ps->owned_reader = std::move(reader);
  if (!ps->source->Seek(target) || !ps->source->Start()) return nullptr;
  Prime(*ps->source, ps->num_frames);
  return ps;
}

bool Player::ReseekLive(
    uint64_t frame,
    uint64_t now_frame,
    bool engine_running
) {
  const uint64_t target = std::min(frame, live_num_frames_);
  // Stop the old read-ahead thread before building the fresh source; the reason
  // this ordering is safe is recorded at Mixer::ReseekLive.
  live_source_->Stop();
  auto ps = BuildReseekSource(target);
  if (ps == nullptr) {
    live_source_->Start();  // rebuild failed: resume the old source in place
    return false;
  }
  live_source_ = ps->source.get();
  live_num_frames_ = ps->num_frames;
  num_frames_.store(ps->num_frames, std::memory_order_relaxed);
  published_.Publish(std::move(ps), now_frame, engine_running);
  return true;
}

void Player::Seek(uint64_t frame, uint64_t now_frame, bool engine_running) {
  bool committed = true;
  if (live_source_ != nullptr) {
    if (engine_running || live_source_->is_running()) {
      // Rebuild whenever either side is live: the device may be draining this
      // ring (Pause leaves is_running() false a block early — #25), or the
      // read-ahead thread is running and AudioSource::Seek refuses it.
      committed = ReseekLive(frame, now_frame, engine_running);
    } else {
      // Device stopped and the source idle — the only truly quiescent state, so
      // the in-place Clear races nothing. Clamp past the end for a seek past it.
      live_source_->Seek(std::min(frame, live_num_frames_));
    }
  }
  // A failed rebuild resumed the old source in place; suppress kSeek so the
  // transport holds at the audible position rather than jumping to the target.
  if (!committed) return;
  Command command{CommandType::kSeek};
  command.frame = frame;
  Enqueue(command);
}

void Player::ReleaseRetiredSources() {
  published_.ReclaimAll();
}

}  // namespace kitbag
