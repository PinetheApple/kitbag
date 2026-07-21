// Setup, off-thread publish, transport, and getters. The realtime drain and
// mix live in mixer_render.cpp.
#include "mixer/mixer.h"

#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>

#include "media/pcm_source_reader.h"
#include "media/resampling_source_reader.h"

namespace kitbag {
namespace {

// How far ahead the setup path buffers before playback: eight typical
// 512-frame blocks, and inside the source ring so it is always reachable.
constexpr uint64_t kPrimeAheadFrames = Mixer::kMaxBlockFrames;
constexpr auto kPrimeTimeout = std::chrono::seconds(2);
constexpr auto kPrimePoll = std::chrono::milliseconds(1);

}  // namespace

bool Mixer::BuildTrackSource(TrackSource& ts, SourceReader* base) {
  // Resample on load so the ring — and Process — only ever see engine-rate
  // frames (SPEC.md §4.1). num_frames is the resampled length.
  SourceReader* reader = base;
  const uint32_t rate = base->sample_rate();
  if (rate != 0 && rate != engine_rate_) {
    auto rs = std::make_unique<ResamplingSourceReader>(base, engine_rate_);
    if (!rs->ok()) return false;
    ts.resampler = std::move(rs);
    reader = ts.resampler.get();
  }
  ts.channels = reader->channels();
  // scratch_ is sized to kMaxChannels at construction and never grows, so a
  // wider track would overrun it under a concurrent callback read. Reject at
  // load rather than reallocate on the callback path.
  if (ts.channels == 0 || ts.channels > kMaxChannels) return false;
  ts.num_frames = reader->total_frames();
  ts.source = std::make_unique<AudioSource>();
  return ts.source->Open(reader);
}

void Mixer::PublishTrack(
    int track,
    std::unique_ptr<TrackSource> ts,
    uint64_t now_frame,
    bool engine_running
) {
  Track& t = tracks_[track];
  // The source pointee survives the move into the publisher node, so this raw
  // handle stays valid for the off-thread transport work.
  t.live_source = ts->source.get();
  t.live_num_frames = ts->num_frames;
  if (track >= track_count_) track_count_ = track + 1;
  longest_frames_ = std::max(longest_frames_, ts->num_frames);
  t.published.Publish(std::move(ts), now_frame, engine_running);
}

void Mixer::SetTrackData(
    int track,
    const float* pcm,
    uint64_t num_frames,
    uint32_t channels,
    uint32_t sample_rate,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks) return;
  auto ts = std::make_unique<TrackSource>();
  auto reader =
      std::make_unique<PcmSourceReader>(pcm, num_frames, channels, sample_rate);
  if (!BuildTrackSource(*ts, reader.get())) return;
  ts->owned_reader = std::move(reader);
  PublishTrack(track, std::move(ts), now_frame, engine_running);
}

bool Mixer::SetTrackSource(
    int track,
    SourceReader* reader,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks || reader == nullptr) return false;
  auto ts = std::make_unique<TrackSource>();
  if (!BuildTrackSource(*ts, reader)) return false;
  // owned_reader stays null: the caller owns `reader` and must outlive the track.
  PublishTrack(track, std::move(ts), now_frame, engine_running);
  return true;
}

void Mixer::Enqueue(const Command& command) {
  if (!commands_.Push(command)) ++dropped_commands_;
}

void Mixer::SetGain(int track, float gain) {
  if (track < 0 || track >= track_count_) return;
  Command command{CommandType::kSetGain};
  command.track = track;
  command.fvalue = std::clamp(gain, kMinGain, kMaxGain);
  Enqueue(command);
}

void Mixer::SetMute(int track, bool muted) {
  if (track < 0 || track >= track_count_) return;
  Command command{CommandType::kSetMute};
  command.track = track;
  command.fvalue = muted ? 1.0f : 0.0f;
  Enqueue(command);
}

void Mixer::SetSolo(int track, bool soloed) {
  if (track < 0 || track >= track_count_) return;
  Command command{CommandType::kSetSolo};
  command.track = track;
  command.fvalue = soloed ? 1.0f : 0.0f;
  Enqueue(command);
}

float Mixer::gain(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].gain.load(std::memory_order_relaxed)
             : 0.0f;
}

bool Mixer::muted(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].mute.load(std::memory_order_relaxed)
             : false;
}

bool Mixer::soloed(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].solo.load(std::memory_order_relaxed)
             : false;
}

void Mixer::Prime(AudioSource& src, uint64_t num_frames) {
  const uint64_t pos = src.position();
  const uint64_t remaining = num_frames > pos ? num_frames - pos : 0;
  const uint64_t target = std::min(remaining, kPrimeAheadFrames);
  const auto deadline = std::chrono::steady_clock::now() + kPrimeTimeout;
  while (src.buffered_frames() < target && !src.is_at_end()) {
    if (std::chrono::steady_clock::now() > deadline) break;
    std::this_thread::sleep_for(kPrimePoll);
  }
}

void Mixer::Play() {
  for (int i = 0; i < track_count_; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    if (!t.live_source->is_running()) t.live_source->Start();
    Prime(*t.live_source, t.live_num_frames);
  }
  Enqueue({CommandType::kPlay});
}

void Mixer::Stop() {
  Enqueue({CommandType::kStop});
  for (int i = 0; i < track_count_; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    t.live_source->Stop();
    t.live_source->Seek(0);
  }
}

void Mixer::Pause() {
  Enqueue({CommandType::kPause});
  for (int i = 0; i < track_count_; ++i) {
    if (tracks_[i].live_source != nullptr) tracks_[i].live_source->Stop();
  }
}

void Mixer::Seek(uint64_t frame) {
  // The source reposition below is only quiescence-safe while the callback is
  // not draining this source (AudioSource::Seek's contract). Seeking during
  // live playback needs the rebuild-and-republish path, which is A4; A3 makes
  // the transport counter race-free, which is what race #2 (SPEC.md §2.2) was.
  for (int i = 0; i < track_count_; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    const bool was_running = t.live_source->is_running();
    t.live_source->Stop();
    // Clamp past a short stem's end so it seeks to end (silent) rather than
    // refusing and desyncing from the transport.
    t.live_source->Seek(std::min(frame, t.live_num_frames));
    if (!was_running) continue;
    t.live_source->Start();
    Prime(*t.live_source, t.live_num_frames);
  }
  Command command{CommandType::kSeek};
  command.frame = frame;
  Enqueue(command);
}

uint64_t Mixer::track_frames(int track) const {
  return track >= 0 && track < track_count_ ? tracks_[track].live_num_frames
                                            : 0;
}

uint64_t Mixer::track_buffered(int track) const {
  if (track < 0 || track >= track_count_) return 0;
  const AudioSource* src = tracks_[track].live_source;
  return src != nullptr ? src->buffered_frames() : 0;
}

bool Mixer::track_at_end(int track) const {
  if (track < 0 || track >= track_count_) return true;
  const AudioSource* src = tracks_[track].live_source;
  return src == nullptr || src->is_at_end();
}

void Mixer::ReleaseRetiredSources() {
  for (auto& track : tracks_) track.published.ReclaimAll();
}

}  // namespace kitbag
