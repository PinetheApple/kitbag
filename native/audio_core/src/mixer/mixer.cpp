// App-thread setup, transport and getters. Each track's off-thread publish and
// the #25 rebuild-and-swap seek live in StreamingTrack; the realtime drain and
// mix live in mixer_render.cpp.
#include "mixer/mixer.h"

#include <algorithm>
#include <cmath>
#include <memory>

namespace kitbag {

Mixer::Mixer(uint32_t engine_rate)
    : scratch_(
          static_cast<size_t>(StreamingTrack::kMaxBlockFrames) *
              StreamingTrack::kMaxChannels,
          0.0f
      ),
      crossfade_frames_(
          std::llround(kLoopCrossfadeSeconds * static_cast<double>(engine_rate))
      ) {
  for (auto& track : tracks_) {
    track.stream = std::make_unique<StreamingTrack>(engine_rate);
  }
}

void Mixer::ReserveCallbackFrames(uint32_t frames) {
  for (auto& track : tracks_) track.stream->ReserveCallbackFrames(frames);
}

void Mixer::NoteTrackLoaded(int track) {
  if (track >= track_count_.load(std::memory_order_relaxed)) {
    track_count_.store(track + 1, std::memory_order_relaxed);
  }
  RecomputeLongestFrames();
  if (app_playing_) tracks_[track].stream->StartAndPrime();
}

SourceStamp Mixer::JoinStamp() const {
  return {.epoch = app_epoch_, .layout = app_layout_, .align = true};
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
  const auto frame = static_cast<uint64_t>(PlannedHead().stream);
  StreamingTrack& stream = *tracks_[track].stream;
  if (!stream.Load(path, now_frame, engine_running, JoinStamp(), frame)) {
    return false;
  }
  NoteTrackLoaded(track);
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
  const auto frame = static_cast<uint64_t>(PlannedHead().stream);
  const SourceStamp stamp = JoinStamp();
  StreamingTrack& stream = *tracks_[track].stream;
  if (!stream.LoadReader(reader, now_frame, engine_running, stamp, frame)) {
    return false;
  }
  NoteTrackLoaded(track);
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

void Mixer::SetMasterGain(float gain) {
  Command command{CommandType::kSetMasterGain};
  command.fvalue = std::clamp(gain, kMinGain, kMaxGain);
  Enqueue(command);
}

float Mixer::gain(int track) const {
  return track >= 0 && track < kMaxTracks
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
  app_playing_ = true;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StartAndPrime();
  Enqueue({CommandType::kPlay});
}

void Mixer::Stop(uint64_t now_frame, bool engine_running) {
  app_playing_ = false;
  Enqueue({CommandType::kStop});
  Relayout({.layout = app_layout_}, now_frame, engine_running);
}

void Mixer::Pause() {
  app_playing_ = false;
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopSource();
}

void Mixer::Seek(uint64_t frame, uint64_t now_frame, bool engine_running) {
  const uint64_t longest = longest_frames_.load(std::memory_order_relaxed);
  const int64_t target =
      SeekTarget(static_cast<int64_t>(std::min(frame, longest)));
  Relayout({.frame = target, .layout = app_layout_}, now_frame, engine_running);
}

int64_t Mixer::SeekTarget(int64_t frame) const {
  if (app_layout_.looping && frame >= app_layout_.end) return app_layout_.start;
  return frame;
}

Mixer::LoopResult Mixer::SetLoop(
    int64_t start,
    int64_t end,
    uint64_t now_frame,
    bool engine_running
) {
  const auto longest =
      static_cast<int64_t>(longest_frames_.load(std::memory_order_relaxed));
  if (start < 0 || end > longest ||
      end - start < kMinLoopCrossfades * crossfade_frames_) {
    return LoopResult::kInvalid;
  }
  const Head head = PlannedHead();
  const int64_t song = app_layout_.SongFrameAt(head.stream);
  const bool keep = song < end;
  const TransportPlan plan{
      .kind = keep && !head.jump_pending ? PlanKind::kKeep : PlanKind::kJump,
      .frame = keep ? song : start,
      .base = head.transport,
      .layout = {
          .looping = true,
          .start = start,
          .end = end,
          .crossfade = crossfade_frames_
      }
  };
  return Relayout(plan, now_frame, engine_running) ? LoopResult::kOk
                                                   : LoopResult::kRebuildFailed;
}

bool Mixer::ClearLoop(uint64_t now_frame, bool engine_running) {
  if (!app_layout_.looping) return true;
  const Head head = PlannedHead();
  const TransportPlan plan{
      .kind = head.jump_pending ? PlanKind::kJump : PlanKind::kKeep,
      .frame = app_layout_.SongFrameAt(head.stream),
      .base = head.transport,
      .layout = {}
  };
  return Relayout(plan, now_frame, engine_running);
}

Mixer::Head Mixer::PlannedHead() const {
  const auto* node = plans_.Get();
  const uint64_t adopted = plan_generation_.load(std::memory_order_acquire);
  const int64_t now = transport_frame_.load(std::memory_order_relaxed);
  if (node == nullptr) {
    return {.stream = now, .transport = now, .jump_pending = false};
  }
  const TransportPlan& plan = node->value;
  int64_t base = plan.base;
  if (plan.kind == PlanKind::kJump) {
    if (node->generation != adopted) {
      return {.stream = plan.frame, .transport = now, .jump_pending = true};
    }
    base = jump_base_.load(std::memory_order_relaxed);
  }
  const int64_t elapsed = std::max<int64_t>(now - base, 0);
  return {
      .stream = plan.frame + elapsed,
      .transport = now,
      .jump_pending = false
  };
}

bool Mixer::Relayout(
    TransportPlan plan,
    uint64_t now_frame,
    bool engine_running
) {
  plan.epoch = app_epoch_ + 1;
  const SourceStamp stamp{
      .epoch = plan.epoch,
      .layout = plan.layout,
      .align = true,
      .plays_early = plan.kind == PlanKind::kKeep
  };
  if (!StageAll(plan.frame, stamp, engine_running)) return false;
  app_epoch_ = plan.epoch;
  app_layout_ = plan.layout;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    tracks_[i].stream->CommitStaged(now_frame, engine_running);
  }
  plans_.Publish(
      std::make_unique<TransportPlan>(plan),
      now_frame,
      engine_running
  );
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopPrevious();
  return true;
}

bool Mixer::StageAll(
    int64_t frame,
    const SourceStamp& stamp,
    bool engine_running
) {
  const int count = track_count_.load(std::memory_order_relaxed);
  const auto target = static_cast<uint64_t>(std::max<int64_t>(frame, 0));
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].stream->Stage(target, stamp, engine_running)) continue;
    for (int j = 0; j < i; ++j) tracks_[j].stream->DropStaged();
    return false;
  }
  return true;
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
  plans_.ReclaimAll();
}

}  // namespace kitbag
