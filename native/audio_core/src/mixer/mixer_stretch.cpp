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

}  // namespace

KeyBus* Mixer::BusAt(int slot) const {
  const auto* node = buses_[slot].Get();
  return node == nullptr ? nullptr : node->value.bus.get();
}

KeyBus* Mixer::AnyBus() const {
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (KeyBus* bus = BusAt(s)) return bus;
  }
  return nullptr;
}

bool Mixer::RtWantsStretch() const {
  if (rate_target_ != kUnityRate) return true;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (tracks_[t].stream->ready() &&
        tracks_[t].pitch.load(std::memory_order_relaxed) != 0) {
      return true;
    }
  }
  return false;
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

// Capped at what the stem has left, so a stem near its end never stalls it.
bool Mixer::RingsReady(int64_t frames) const {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    const StreamingTrack::RtView view = tracks_[t].stream->rt_view();
    int64_t frame = 0;
    if (!TransportFrameFor(view, &frame)) continue;
    const auto position = static_cast<int64_t>(view.source->position());
    int64_t need = std::max<int64_t>(frame - position, 0) + frames;
    if (!view.stamp.layout.looping) {
      const auto length = static_cast<int64_t>(tracks_[t].stream->frames());
      need = std::min(need, length - position);
    }
    if (static_cast<int64_t>(view.source->buffered_frames()) < need) {
      return false;
    }
  }
  return true;
}

void Mixer::ReadPreRoll(int64_t lag, bool any_solo) {
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (KeyBus* bus = BusAt(s)) {
      std::fill(bus->preroll.begin(), bus->preroll.end(), 0.0f);
    }
  }
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    tracks_[t].fade_left = 0;
    StreamingTrack::RtView view;
    if (!AlignedView(tracks_[t], &view)) continue;
    const float gain = TrackGain(tracks_[t], any_solo);
    ReadTrackPreRoll(view, TrackBus(tracks_[t]), lag, gain);
  }
}

void Mixer::ReadTrackPreRoll(
    const StreamingTrack::RtView& view,
    KeyBus* bus,
    int64_t lag,
    float gain
) {
  for (int64_t done = 0; done < lag;) {
    const auto n = static_cast<uint32_t>(
        std::min<int64_t>(lag - done, StreamingTrack::kMaxBlockFrames)
    );
    const uint32_t got = view.source->Read(scratch_.data(), n);
    if (bus != nullptr && gain > 0.0f) {
      float* dst = bus->preroll.data() + done * KeyBus::kChannels;
      StreamingTrack::AddToOutput(
          scratch_.data(),
          view.channels,
          got,
          dst,
          gain
      );
    }
    done += n;
  }
}

void Mixer::SeekBuses(int64_t lag) {
  int members[kKeyBusCount] = {};
  CountMembers(members);
  for (int s = 0; s < kKeyBusCount; ++s) {
    KeyBus* bus = BusAt(s);
    if (bus == nullptr) continue;
    bus->idle_frames = 0;
    bus->dormant = members[s] == 0;
    if (bus->dormant) continue;
    bus->stretch.OutputSeek(bus->preroll.data(), static_cast<int>(lag));
  }
}

bool Mixer::BusesAgree(const KeyBus& any) const {
  for (int s = 0; s < kKeyBusCount; ++s) {
    const KeyBus* bus = BusAt(s);
    if (bus != nullptr && bus->vendor_default != any.vendor_default) {
      return false;
    }
  }
  return true;
}

// OutputSeek over [head, head + lag) makes the first output frame the head.
// Mid-switch buses disagree on config, so the prime waits for the last one.
bool Mixer::PrimeIfReady(uint32_t frame_count, bool any_solo) {
  if (!RtWantsStretch()) return false;
  KeyBus* any = AnyBus();
  if (any == nullptr || !BusesAgree(*any)) return false;
  const TimeStretch& stretch = any->stretch;
  const int64_t lag =
      std::min(stretch.SongLagFrames(rate_target_), stretch.SeekFrames());
  const auto take = static_cast<int64_t>(rate_target_ * frame_count);
  if (!RingsReady(lag + take)) return false;
  rate_ = rate_target_;
  carry_ = 0.0;
  ReadPreRoll(lag, any_solo);
  SeekBuses(lag);
  ResetRecords(stretch);
  stream_frame_ += lag;
  transport_frame_.fetch_add(lag, std::memory_order_relaxed);
  seam_left_ = bypass_continues_ ? crossfade_frames_ : 0;
  engaged_.store(true, std::memory_order_relaxed);
  return true;
}

void Mixer::ResetRecords(const TimeStretch& stretch) {
  const int64_t in = stretch.InputLatencyFrames();
  const int64_t out = stretch.OutputLatencyFrames();
  records_.Reset(
      {.out_first = out_clock_ - out,
       .fed_first = static_cast<double>(stream_frame_ + in),
       .rate = rate_,
       .layout = layout_},
      in,
      out
  );
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

void Mixer::MoveToBus(Track& tr, int pitch) {
  const int from = tr.pitch.load(std::memory_order_relaxed);
  if (from != pitch && engaged_.load(std::memory_order_relaxed)) {
    tr.fade_from = from;
    tr.fade_left = crossfade_frames_;
  }
  tr.pitch.store(pitch, std::memory_order_relaxed);
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
    if (bus == nullptr) continue;
    if (members[s] > 0 && bus->dormant) {
      bus->stretch.Reset();
      bus->dormant = false;
    }
    bus->idle_frames = members[s] > 0 ? 0 : bus->idle_frames + frame_count;
    if (bus->idle_frames > bus->drain_frames) bus->dormant = true;
    if (bus->dormant) continue;
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
