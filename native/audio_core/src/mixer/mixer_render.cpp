// The realtime half of the mixer: the command drain and the per-block mix. Runs
// entirely on the audio callback — allocates nothing, takes no lock, frees
// nothing. Setup and transport live in mixer.cpp and StreamingTrack.
#include <algorithm>
#include <cstring>

#include "mixer/mixer.h"

namespace kitbag {

// The exhaustive switch has no `default:` on purpose; see the ApplyCommand
// declaration in mixer.h.
void Mixer::ApplyCommand(const Command& command) {
  Track& t = tracks_[command.track];
  switch (command.type) {
    case CommandType::kSetGain:
      t.gain.store(command.fvalue, std::memory_order_relaxed);
      return;
    case CommandType::kSetMute:
      t.mute.store(command.fvalue != 0.0f, std::memory_order_relaxed);
      return;
    case CommandType::kSetSolo:
      t.solo.store(command.fvalue != 0.0f, std::memory_order_relaxed);
      RecomputeAnySolo();
      return;
    case CommandType::kPlay:
      playing_.store(true, std::memory_order_relaxed);
      return;
    case CommandType::kStop:
    case CommandType::kPause:
      playing_.store(false, std::memory_order_relaxed);
      return;
    case CommandType::kSetMasterGain:
      master_gain_.store(command.fvalue, std::memory_order_relaxed);
      return;
  }
}

void Mixer::AdoptPlan() {
  const auto* node = plans_.Get();
  if (node == nullptr ||
      node->generation == plan_generation_.load(std::memory_order_relaxed)) {
    return;
  }
  const TransportPlan& plan = node->value;
  const int64_t now = transport_frame_.load(std::memory_order_relaxed);
  // A keep counts on from where its head stood when the plan was built, so an
  // old loop that wrapped meanwhile is never replayed; AlignTo skips the gap.
  if (plan.kind == PlanKind::kKeep) {
    stream_frame_ = plan.frame + std::max<int64_t>(now - plan.base, 0);
  } else {
    stream_frame_ = plan.frame;
    jump_base_.store(now, std::memory_order_relaxed);
  }
  layout_ = plan.layout;
  epoch_ = plan.epoch;
  read_frame_.store(
      static_cast<uint64_t>(layout_.SongFrameAt(stream_frame_)),
      std::memory_order_relaxed
  );
  plan_generation_.store(node->generation, std::memory_order_release);
}

bool Mixer::TransportFrameFor(
    const StreamingTrack::RtView& view,
    int64_t* frame
) {
  if (view.source == nullptr) return false;
  if (view.stamp.epoch == epoch_) {
    *frame = stream_frame_;
    return true;
  }
  // Built by a keep whose plan has not landed: until it does, the song frame
  // now playing is that source's stream frame.
  if (!view.stamp.plays_early || view.stamp.epoch < epoch_) return false;
  *frame = layout_.SongFrameAt(stream_frame_);
  return true;
}

// Bounded: it discards at most what the ring holds, a constant. A source still
// behind afterwards stays silent and catches up over the next blocks.
bool Mixer::AlignTo(AudioSource& source, int64_t frame) {
  const int64_t lag = frame - static_cast<int64_t>(source.position());
  if (lag < 0) return false;
  auto left = std::min(lag, static_cast<int64_t>(source.buffered_frames()));
  while (left > 0) {
    const auto n = static_cast<uint32_t>(
        std::min<int64_t>(left, StreamingTrack::kMaxBlockFrames)
    );
    source.Read(scratch_.data(), n);
    left -= n;
  }
  return static_cast<int64_t>(source.position()) == frame;
}

void Mixer::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) ApplyCommand(command);
}

void Mixer::RecomputeAnySolo() {
  bool any = false;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].stream->ready() &&
        tracks_[i].solo.load(std::memory_order_relaxed)) {
      any = true;
      break;
    }
  }
  any_solo_.store(any, std::memory_order_relaxed);
}

void Mixer::MixTrack(
    Track& tr,
    float* output,
    uint32_t frame_count,
    bool any_solo
) {
  // Drain first unconditionally: a muted or soloed-out track must still advance
  // so unmuting resumes in sync rather than replaying (SPEC.md §4.4).
  const StreamingTrack::RtView view = tr.stream->rt_view();
  int64_t frame = 0;
  if (!TransportFrameFor(view, &frame)) return;
  if (view.stamp.align && !AlignTo(*view.source, frame)) return;
  const uint32_t got = view.source->Read(scratch_.data(), frame_count);
  if (any_solo && !tr.solo.load(std::memory_order_relaxed)) return;
  if (tr.mute.load(std::memory_order_relaxed)) return;
  const float gain = tr.gain.load(std::memory_order_relaxed) *
                     master_gain_.load(std::memory_order_relaxed);
  if (gain <= 0.0f) return;
  StreamingTrack::AddToOutput(
      scratch_.data(),
      view.channels,
      got,
      output,
      gain
  );
}

void Mixer::MixAllTracks(float* output, uint32_t frame_count, bool any_solo) {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    MixTrack(tracks_[t], output, frame_count, any_solo);
  }
}

// The transport is the longest loaded track, not what was audible: mute, solo
// and zero gain must not end playback (SPEC.md §4.4). A loop never reaches it.
void Mixer::AdvanceTransport(uint32_t frame_count) {
  const auto longest =
      static_cast<int64_t>(longest_frames_.load(std::memory_order_relaxed));
  int64_t advance = frame_count;
  if (!layout_.looping) {
    advance = std::clamp<int64_t>(longest - stream_frame_, 0, frame_count);
  }
  if (advance == 0) {
    playing_.store(false, std::memory_order_relaxed);
    return;
  }
  song_clock_ = {
      .playing = true,
      .first = stream_frame_,
      .frames = static_cast<uint32_t>(advance),
      .layout = layout_
  };
  stream_frame_ += advance;
  transport_frame_.store(
      transport_frame_.load(std::memory_order_relaxed) + advance,
      std::memory_order_relaxed
  );
  read_frame_.store(
      static_cast<uint64_t>(layout_.SongFrameAt(stream_frame_)),
      std::memory_order_relaxed
  );
}

void Mixer::Process(float* output, uint32_t frame_count) {
  // Memset, not accumulate: Engine::Render relies on this clearing whatever it
  // wrote before the call.
  std::memset(output, 0, frame_count * 2 * sizeof(float));
  // Drain first so a seek/stop/pause applies this block even while paused, and
  // so read_frame_ is written only from here.
  ApplyPendingCommands();
  AdoptPlan();
  song_clock_.playing = false;
  // Scratch is sized to kMaxBlockFrames at setup; a wider block cannot be
  // drained without allocating, which the callback must never do.
  if (frame_count > StreamingTrack::kMaxBlockFrames) return;
  if (!playing_.load(std::memory_order_relaxed)) return;

  MixAllTracks(output, frame_count, any_solo_.load(std::memory_order_relaxed));
  AdvanceTransport(frame_count);
}

}  // namespace kitbag
