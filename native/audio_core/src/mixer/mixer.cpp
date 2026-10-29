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
  const SourceStamp stamp{app_epoch_, app_layout_};
  if (!tracks_[track].stream->Load(path, now_frame, engine_running, stamp)) {
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
  const SourceStamp stamp{app_epoch_, app_layout_};
  StreamingTrack& stream = *tracks_[track].stream;
  if (!stream.LoadReader(reader, now_frame, engine_running, stamp)) {
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
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StartAndPrime();
  Enqueue({CommandType::kPlay});
}

void Mixer::Stop(uint64_t now_frame, bool engine_running) {
  Enqueue({CommandType::kStop});
  Relayout(PlanKind::kJump, 0, app_layout_, now_frame, engine_running);
}

void Mixer::Pause() {
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopSource();
}

void Mixer::Seek(uint64_t frame, uint64_t now_frame, bool engine_running) {
  const uint64_t longest = longest_frames_.load(std::memory_order_relaxed);
  const int64_t target =
      SeekTarget(static_cast<int64_t>(std::min(frame, longest)));
  Relayout(PlanKind::kJump, target, app_layout_, now_frame, engine_running);
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
  const LoopLayout layout{true, start, end, crossfade_frames_};
  const Head head = PlannedHead();
  const bool keep = head.frame < end;
  const bool ok = Relayout(
      keep && !head.jump_pending ? PlanKind::kKeep : PlanKind::kJump,
      keep ? head.frame : start,
      layout,
      now_frame,
      engine_running
  );
  return ok ? LoopResult::kOk : LoopResult::kRebuildFailed;
}

bool Mixer::ClearLoop(uint64_t now_frame, bool engine_running) {
  if (!app_layout_.looping) return true;
  const Head head = PlannedHead();
  const PlanKind kind = head.jump_pending ? PlanKind::kJump : PlanKind::kKeep;
  return Relayout(kind, head.frame, {}, now_frame, engine_running);
}

Mixer::Head Mixer::PlannedHead() const {
  const auto* node = plans_.Get();
  const bool jump_pending =
      node != nullptr &&
      node->generation != plan_generation_.load(std::memory_order_relaxed) &&
      node->value.kind == PlanKind::kJump;
  if (!jump_pending) return {static_cast<int64_t>(position()), false};
  return {node->value.frame, true};
}

bool Mixer::Relayout(
    PlanKind kind,
    int64_t frame,
    const LoopLayout& layout,
    uint64_t now_frame,
    bool engine_running
) {
  const SourceStamp stamp{
      app_epoch_ + 1,
      layout,
      true,
      kind == PlanKind::kKeep
  };
  if (!StageAll(frame, stamp, engine_running)) return false;
  app_epoch_ = stamp.epoch;
  app_layout_ = layout;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    tracks_[i].stream->CommitStaged(now_frame, engine_running);
  }
  auto plan = std::make_unique<TransportPlan>(
      TransportPlan{kind, frame, app_epoch_, layout}
  );
  plans_.Publish(std::move(plan), now_frame, engine_running);
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
