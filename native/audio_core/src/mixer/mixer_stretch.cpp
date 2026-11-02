#include <algorithm>
#include <cstring>

#include "media/equal_power.h"
#include "mixer/mixer.h"

namespace kitbag {
namespace {

void AddFrame(
    const float* scratch,
    uint32_t channels,
    uint32_t frame,
    KeyBus* bus,
    float gain
) {
  if (bus == nullptr) return;
  StreamingTrack::AddToOutput(
      scratch + static_cast<size_t>(frame) * channels,
      channels,
      1,
      bus->input.data() + static_cast<size_t>(frame) * KeyBus::kChannels,
      gain
  );
}

bool KeepAwake(KeyBus* bus, int members, uint32_t frame_count) {
  if (members > 0 && bus->dormant) {
    bus->stretch.Reset();
    bus->dormant = false;
    bus->drained.store(false, std::memory_order_relaxed);
  }
  bus->idle_frames = members > 0 ? 0 : bus->idle_frames + frame_count;
  if (bus->idle_frames > bus->drain_frames) {
    bus->dormant = true;
    bus->drained.store(true, std::memory_order_release);
  }
  return !bus->dormant;
}

}  // namespace

KeyBus* Mixer::BusAt(int slot) const {
  return rt_buses_[slot];
}

KeyBus* Mixer::AnyBus() const {
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (KeyBus* bus = BusAt(s)) return bus;
  }
  return nullptr;
}

void Mixer::CountMembers(int* members) const {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (!tracks_[t].stream->ready()) continue;
    ++members
        [tracks_[t].pitch.load(std::memory_order_relaxed) - kMinPitchSemitones];
  }
}

KeyBus* Mixer::TrackBus(const Track& tr) const {
  return BusAt(tr.pitch.load(std::memory_order_relaxed) - kMinPitchSemitones);
}

float Mixer::TrackGain(const Track& tr, bool any_solo) const {
  if (any_solo && !tr.solo.load(std::memory_order_relaxed)) return 0.0f;
  if (tr.mute.load(std::memory_order_relaxed)) return 0.0f;
  return tr.gain.load(std::memory_order_relaxed);
}

bool Mixer::AlignedView(const Track& tr, StreamingTrack::RtView* view) {
  *view = tr.stream->rt_view();
  int64_t frame = 0;
  if (!TransportFrameFor(*view, &frame)) return false;
  return !view->stamp.align || AlignTo(*view->source, frame);
}

void Mixer::ApplyPendingRate() {
  if (rate_target_ == rate_) return;
  if (out_clock_ - records_.newest().out_first < kMinRecordSpacingFrames) {
    return;
  }
  rate_ = rate_target_;
  PushRecord();
}

void Mixer::PushRecord() {
  records_.Push(
      {.out_first = out_clock_,
       .fed_first = static_cast<double>(stream_frame_) + carry_,
       .rate = rate_,
       .layout = layout_}
  );
}

// Muted, soloed-out and silent stems still feed zeros, so a bus never holds
// audio from before the mute (SPEC.md §4.4).
void Mixer::FeedBuses(uint32_t take, bool any_solo) {
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (KeyBus* bus = BusAt(s)) {
      std::memset(
          bus->input.data(),
          0,
          static_cast<size_t>(take) * KeyBus::kChannels * sizeof(float)
      );
    }
  }
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    StreamingTrack::RtView view;
    if (!AlignedView(tracks_[t], &view)) continue;
    const uint32_t got = view.source->Read(scratch_.data(), take);
    FeedTrack(tracks_[t], view.channels, got, TrackGain(tracks_[t], any_solo));
  }
}

// A move during a fade fades from whichever bus is louder, or reverses the
// fade when it returns to its origin, so no contribution is cut at full gain.
void Mixer::MoveToBus(Track& tr, int pitch) {
  const int to = tr.pitch.load(std::memory_order_relaxed);
  tr.pitch.store(pitch, std::memory_order_relaxed);
  if (to == pitch || !engaged_.load(std::memory_order_relaxed)) return;
  if (tr.fade_left > 0 && tr.fade_from == pitch) {
    tr.fade_from = to;
    tr.fade_left = crossfade_frames_ - tr.fade_left;
    return;
  }
  if (2 * tr.fade_left <= crossfade_frames_) tr.fade_from = to;
  tr.fade_left = crossfade_frames_;
}

// A stem changing key is crossfaded across the two bus inputs: a hard cut
// there is a step the STFT spreads into a click.
void Mixer::FeedTrack(Track& tr, uint32_t channels, uint32_t got, float gain) {
  KeyBus* to = TrackBus(tr);
  KeyBus* from =
      tr.fade_left > 0 ? BusAt(tr.fade_from - kMinPitchSemitones) : nullptr;
  uint32_t f = 0;
  for (; tr.fade_left > 0 && f < got; ++f, --tr.fade_left) {
    const FadeGains fade =
        EqualPowerAt(crossfade_frames_ - tr.fade_left, crossfade_frames_);
    AddFrame(scratch_.data(), channels, f, from, gain * fade.out);
    AddFrame(scratch_.data(), channels, f, to, gain * fade.in);
  }
  if (to == nullptr || gain <= 0.0f || f >= got) return;
  StreamingTrack::AddToOutput(
      scratch_.data() + static_cast<size_t>(f) * channels,
      channels,
      got - f,
      to->input.data() + static_cast<size_t>(f) * KeyBus::kChannels,
      gain
  );
}

// A bus left without stems drains its tail, then sleeps; waking resets it so
// it never replays what it held.
void Mixer::RunBuses(float* output, uint32_t take, uint32_t frame_count) {
  int members[kKeyBusCount] = {};
  CountMembers(members);
  const float master = master_gain_.load(std::memory_order_relaxed);
  for (int s = 0; s < kKeyBusCount; ++s) {
    KeyBus* bus = BusAt(s);
    if (bus == nullptr || !KeepAwake(bus, members[s], frame_count)) continue;
    bus->stretch.Process(
        bus->input.data(),
        static_cast<int>(take),
        bus->output.data(),
        static_cast<int>(frame_count)
    );
    StreamingTrack::AddToOutput(
        bus->output.data(),
        KeyBus::kChannels,
        frame_count,
        output,
        master
    );
  }
}

// Engaging mid-play fades from the unstretched continuation, still in the
// pre-roll, because the vocoder's phase at the head is not the source's.
void Mixer::BlendSeam(float* output, uint32_t frame_count) {
  const float master = master_gain_.load(std::memory_order_relaxed);
  for (uint32_t f = 0; f < frame_count && seam_left_ > 0; ++f, --seam_left_) {
    const int64_t i = crossfade_frames_ - seam_left_;
    const FadeGains fade = EqualPowerAt(i, crossfade_frames_);
    for (int c = 0; c < KeyBus::kChannels; ++c) {
      float raw = 0.0f;
      for (int s = 0; s < kKeyBusCount; ++s) {
        const KeyBus* bus = BusAt(s);
        if (bus != nullptr && !bus->dormant) {
          raw += bus->preroll[i * KeyBus::kChannels + c];
        }
      }
      float& sample = output[f * KeyBus::kChannels + c];
      sample = raw * master * fade.out + sample * fade.in;
    }
  }
}

bool Mixer::SongEndReached(int64_t out_frame) const {
  if (layout_.looping) return false;
  const auto longest =
      static_cast<int64_t>(longest_frames_.load(std::memory_order_relaxed));
  return records_.AudibleAt(out_frame) >= longest;
}

uint32_t Mixer::AudibleFrames(int64_t first, uint32_t frame_count) const {
  if (!SongEndReached(first + frame_count - 1)) return frame_count;
  uint32_t frames = 0;
  while (frames < frame_count && !SongEndReached(first + frames)) ++frames;
  return frames;
}

void Mixer::AdvanceStretch(uint32_t take, uint32_t frame_count) {
  const int64_t first = out_clock_;
  stream_frame_ += take;
  transport_frame_.fetch_add(take, std::memory_order_relaxed);
  out_clock_ += frame_count;
  song_clock_ = {
      .playing = true,
      .first = first,
      .frames = AudibleFrames(first, frame_count),
      .layout = layout_,
      .records = &records_
  };
  int64_t audible = records_.AudibleAt(out_clock_);
  if (!layout_.looping) {
    audible = std::min(
        audible,
        static_cast<int64_t>(longest_frames_.load(std::memory_order_relaxed))
    );
  }
  read_frame_.store(static_cast<uint64_t>(audible), std::memory_order_relaxed);
}

// Feeding runs past the end of the song so the pipeline drains; the transport
// ends when the audible frame reaches it (SPEC.md §4.4).
void Mixer::StretchBlock(float* output, uint32_t frame_count, bool any_solo) {
  if (SongEndReached(out_clock_)) {
    playing_.store(false, std::memory_order_relaxed);
    return;
  }
  ApplyPendingRate();
  const double want = static_cast<double>(rate_) * frame_count + carry_;
  const auto take = static_cast<uint32_t>(want);
  carry_ = want - take;
  FeedBuses(take, any_solo);
  RunBuses(output, take, frame_count);
  BlendSeam(output, frame_count);
  AdvanceStretch(take, frame_count);
}

}  // namespace kitbag
