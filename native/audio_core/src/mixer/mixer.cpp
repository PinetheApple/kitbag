// App-thread setup, transport and getters. Each track's off-thread publish and
// the #25 rebuild-and-swap seek live in StreamingTrack; the realtime drain and
// mix live in mixer_render.cpp.
#include "mixer/mixer.h"

#include <algorithm>
#include <memory>

namespace kitbag {

Mixer::Mixer(uint32_t engine_rate)
    : scratch_(
          static_cast<size_t>(StreamingTrack::kMaxBlockFrames) *
              StreamingTrack::kMaxChannels,
          0.0f
      ) {
  for (auto& track : tracks_) {
    track.stream = std::make_unique<StreamingTrack>(engine_rate);
  }
}

void Mixer::NoteTrackLoaded(int track) {
  if (track >= track_count_.load(std::memory_order_relaxed)) {
    track_count_.store(track + 1, std::memory_order_relaxed);
  }
}

void Mixer::RecomputeLongestFrames() {
  uint64_t longest = 0;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    longest = std::max(longest, tracks_[i].stream->live_num_frames());
  }
  longest_frames_.store(longest, std::memory_order_relaxed);
}

bool Mixer::LoadTrack(
    int track,
    const char* path,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks) return false;
  if (!tracks_[track].stream->Load(path, now_frame, engine_running)) {
    return false;
  }
  NoteTrackLoaded(track);
  RecomputeLongestFrames();
  return true;
}

void Mixer::UnloadTrack(int track, uint64_t now_frame, bool engine_running) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  tracks_[track].stream->Unload(now_frame, engine_running);
  RecomputeLongestFrames();
}

bool Mixer::track_ready(int track) const {
  if (track < 0 || track >= kMaxTracks) return false;
  return tracks_[track].stream->ready();
}

bool Mixer::SetTrackSource(
    int track,
    SourceReader* reader,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks) return false;
  if (!tracks_[track].stream->LoadReader(reader, now_frame, engine_running)) {
    return false;
  }
  NoteTrackLoaded(track);
  RecomputeLongestFrames();
  return true;
}

void Mixer::Enqueue(const Command& command) {
  if (!commands_.Push(command)) ++dropped_commands_;
}

void Mixer::SetGain(int track, float gain) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  Command command{CommandType::kSetGain};
  command.track = track;
  command.fvalue = std::clamp(gain, kMinGain, kMaxGain);
  Enqueue(command);
}

void Mixer::SetMute(int track, bool muted) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  Command command{CommandType::kSetMute};
  command.track = track;
  command.fvalue = muted ? 1.0f : 0.0f;
  Enqueue(command);
}

void Mixer::SetSolo(int track, bool soloed) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  Command command{CommandType::kSetSolo};
  command.track = track;
  command.fvalue = soloed ? 1.0f : 0.0f;
  Enqueue(command);
}

float Mixer::gain(int track) const {
  return track >= 0 && track < track_count_.load(std::memory_order_relaxed)
             ? tracks_[track].gain.load(std::memory_order_relaxed)
             : 0.0f;
}

bool Mixer::muted(int track) const {
  return track >= 0 && track < track_count_.load(std::memory_order_relaxed)
             ? tracks_[track].mute.load(std::memory_order_relaxed)
             : false;
}

bool Mixer::soloed(int track) const {
  return track >= 0 && track < track_count_.load(std::memory_order_relaxed)
             ? tracks_[track].solo.load(std::memory_order_relaxed)
             : false;
}

void Mixer::Play() {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StartAndPrime();
  Enqueue({CommandType::kPlay});
}

void Mixer::Stop(uint64_t now_frame, bool engine_running) {
  Enqueue({CommandType::kStop});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    tracks_[i].stream->RewindForStop(now_frame, engine_running);
  }
}

void Mixer::Pause() {
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopSource();
}

void Mixer::Seek(uint64_t frame, uint64_t now_frame, bool engine_running) {
  const int count = track_count_.load(std::memory_order_relaxed);
  bool committed = true;
  for (int i = 0; i < count; ++i) {
    if (!tracks_[i].stream->Seek(frame, now_frame, engine_running)) {
      committed = false;
    }
  }
  // A failed rebuild resumed the old source in place; suppress kSeek so the
  // transport holds at the audible position rather than jumping to the target.
  if (!committed) return;
  Command command{CommandType::kSeek};
  command.frame = frame;
  Enqueue(command);
}

uint64_t Mixer::track_frames(int track) const {
  return track >= 0 && track < track_count_.load(std::memory_order_relaxed)
             ? tracks_[track].stream->live_num_frames()
             : 0;
}

uint64_t Mixer::track_buffered(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return 0;
  }
  return tracks_[track].stream->buffered_frames();
}

uint64_t Mixer::rt_track_buffered(int track) const {
  if (track < 0 || track >= kMaxTracks) return 0;
  return tracks_[track].stream->rt_buffered();
}

bool Mixer::track_at_end(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return true;
  }
  return tracks_[track].stream->at_end();
}

void Mixer::ReleaseRetiredSources() {
  for (auto& track : tracks_) track.stream->ReleaseRetiredSources();
}

}  // namespace kitbag
