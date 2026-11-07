// App-thread setup, transport and getters. Each track's off-thread publish and
// the #25 rebuild-and-swap seek live in StreamingTrack; the realtime drain and
// mix live in mixer_render.cpp.
#include "mixer/mixer.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <utility>

namespace kitbag {

Mixer::Mixer(uint32_t engine_rate)
    : scratch_(
          static_cast<size_t>(StreamingTrack::kMaxBlockFrames) *
              StreamingTrack::kMaxChannels,
          0.0f
      ),
      crossfade_frames_(
          std::llround(kLoopCrossfadeSeconds * static_cast<double>(engine_rate))
      ),
      sample_rate_(static_cast<float>(engine_rate)),
      handover_lead_frames_(
          std::llround(kHandOverLeadSeconds * static_cast<double>(engine_rate))
      ) {
  const auto preroll = static_cast<uint32_t>(
      TimeStretch::DefaultConfig(sample_rate_).PreRollFrames()
  );
  for (auto& track : tracks_) {
    track.stream = std::make_unique<StreamingTrack>(engine_rate);
    track.stream->ReservePreRollFrames(preroll);
  }
  records_.Reserve(preroll / kMinRecordSpacingFrames + 2);
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
    FrameClock clock,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks) return false;
  const bool was_engaged = app_engaged_;
  const Prepared prepared = PrepareBusFor(track, clock, engine_running);
  const auto frame = static_cast<uint64_t>(PlannedHead().stream);
  StreamingTrack& stream = *tracks_[track].stream;
  if (!stream.Load(path, clock, engine_running, JoinStamp(), frame)) {
    UndoPrepare(prepared.created, was_engaged, clock, engine_running);
    return false;
  }
  NoteTrackLoaded(track);
  if (prepared.prime) PrimeNow(clock, engine_running);
  return true;
}

void Mixer::UnloadTrack(int track, FrameClock clock, bool engine_running) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  tracks_[track].stream->Unload(clock, engine_running);
  ResetTrackPitch(track);
  RecomputeLongestFrames();
  FreeUnusedBuses(clock, engine_running);
}

bool Mixer::track_ready(int track) const {
  if (track < 0 || track >= kMaxTracks) return false;
  return tracks_[track].stream->ready();
}

bool Mixer::SetTrackSource(
    int track,
    SourceReader* reader,
    FrameClock clock,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks) return false;
  const bool was_engaged = app_engaged_;
  const Prepared prepared = PrepareBusFor(track, clock, engine_running);
  const auto frame = static_cast<uint64_t>(PlannedHead().stream);
  const SourceStamp stamp = JoinStamp();
  StreamingTrack& stream = *tracks_[track].stream;
  if (!stream.LoadReader(reader, clock, engine_running, stamp, frame)) {
    UndoPrepare(prepared.created, was_engaged, clock, engine_running);
    return false;
  }
  NoteTrackLoaded(track);
  if (prepared.prime) PrimeNow(clock, engine_running);
  return true;
}

bool Mixer::Enqueue(const Command& command) {
  if (commands_.Push(command)) return true;
  ++dropped_commands_;
  return false;
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

void Mixer::Stop(FrameClock clock, bool engine_running) {
  app_playing_ = false;
  Enqueue({CommandType::kStop});
  ReplanStretch({.layout = app_layout_}, clock, engine_running);
}

void Mixer::Pause() {
  app_playing_ = false;
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopSource();
}

void Mixer::Seek(uint64_t frame, FrameClock clock, bool engine_running) {
  const uint64_t longest = longest_frames_.load(std::memory_order_relaxed);
  const int64_t target =
      SeekTarget(static_cast<int64_t>(std::min(frame, longest)));
  const TransportPlan plan{.frame = target, .layout = app_layout_};
  ReplanStretch(plan, clock, engine_running);
}

void Mixer::ReplanStretch(
    TransportPlan plan,
    FrameClock clock,
    bool engine_running
) {
  const bool was_engaged = std::exchange(app_engaged_, WantsStretch());
  if (!Relayout(plan, clock, engine_running)) app_engaged_ = was_engaged;
}

int64_t Mixer::SeekTarget(int64_t frame) const {
  if (app_layout_.looping && frame >= app_layout_.end) return app_layout_.start;
  return frame;
}

Mixer::LoopResult Mixer::SetLoop(
    int64_t start,
    int64_t end,
    FrameClock clock,
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
  const int64_t heard = stretch_engaged()
                            ? std::min(static_cast<int64_t>(position()), song)
                            : song;
  const bool keep = heard < end;
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
  return Relayout(plan, clock, engine_running) ? LoopResult::kOk
                                               : LoopResult::kRebuildFailed;
}

bool Mixer::ClearLoop(FrameClock clock, bool engine_running) {
  if (!app_layout_.looping) return true;
  const Head head = PlannedHead();
  const TransportPlan plan{
      .kind = head.jump_pending ? PlanKind::kJump : PlanKind::kKeep,
      .frame = app_layout_.SongFrameAt(head.stream),
      .base = head.transport,
      .layout = {}
  };
  return Relayout(plan, clock, engine_running);
}

Mixer::Head Mixer::PlannedHead() const {
  const auto* node = plans_.Get();
  const uint64_t adopted = plan_generation_.load(std::memory_order_acquire);
  const int64_t now = transport_frame_.load(std::memory_order_relaxed);
  if (node == nullptr) {
    return {.stream = now, .transport = now, .jump_pending = false};
  }
  const TransportPlan& plan = node->value;
  if (plan.kind == PlanKind::kHandOver) {
    return {
        .stream = plan.frame + now - plan.base,
        .transport = now,
        .jump_pending = false
    };
  }
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
    FrameClock clock,
    bool engine_running
) {
  if (plan.kind == PlanKind::kJump && app_engaged_ && BusesInUse() > 0) {
    return PrimedRelayout(plan, clock, engine_running);
  }
  if (!PlainRelayout(plan, clock, engine_running)) return false;
  if (plan.kind == PlanKind::kJump) {
    for (int bank = 0; bank < kBanks; ++bank) {
      FreeBank(bank, clock, engine_running);
    }
    app_primed_ = false;
    MatchBusConfig(0, true);
  } else if (PrimeAwaitingEngage()) {
    PrimeNow(clock, engine_running);
  }
  return true;
}

bool Mixer::PlainRelayout(
    TransportPlan plan,
    FrameClock clock,
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
  CommitPlan(plan, clock, engine_running);
  return true;
}

void Mixer::CommitPlan(
    const TransportPlan& plan,
    FrameClock clock,
    bool engine_running
) {
  app_epoch_ = plan.epoch;
  app_layout_ = plan.layout;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    tracks_[i].stream->CommitStaged(clock, engine_running);
  }
  plans_.Publish(
      std::make_unique<TransportPlan>(plan),
      clock.Now(),
      engine_running
  );
  for (int i = 0; i < count; ++i) tracks_[i].stream->StopPrevious();
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

uint64_t Mixer::ring_frames() const {
  return tracks_[0].stream->ring_frames();
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
  for (auto& bank : buses_) {
    for (auto& slot : bank) slot.ReclaimAll();
  }
}

}  // namespace kitbag
