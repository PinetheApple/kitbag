// Setup, off-thread publish, transport, and getters. The realtime drain and
// mix live in mixer_render.cpp.
#include "mixer/mixer.h"

#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>

#include "media/file_audio_reader.h"
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
  if (track >= track_count_.load(std::memory_order_relaxed)) {
    track_count_.store(track + 1, std::memory_order_relaxed);
  }
  RecomputeLongestFrames();
  t.published.Publish(std::move(ts), now_frame, engine_running);
}

void Mixer::RecomputeLongestFrames() {
  uint64_t longest = 0;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    longest = std::max(longest, tracks_[i].live_num_frames);
  }
  longest_frames_.store(longest, std::memory_order_relaxed);
}

bool Mixer::LoadTrack(
    int track,
    const char* path,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= kMaxTracks || path == nullptr) return false;
  auto reader = std::make_unique<FileAudioReader>();
  if (!reader->Open(path)) return false;
  auto ts = std::make_unique<TrackSource>();
  if (!BuildTrackSource(*ts, reader.get())) return false;
  ts->owned_reader = std::move(reader);
  PublishTrack(track, std::move(ts), now_frame, engine_running);
  return true;
}

void Mixer::UnloadTrack(int track, uint64_t now_frame, bool engine_running) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  Track& t = tracks_[track];
  // Stop the read-ahead thread now; the node itself is reclaimed off the
  // callback by the publisher, so nothing is freed on the audio thread.
  if (t.live_source != nullptr) t.live_source->Stop();
  t.live_source = nullptr;
  t.live_num_frames = 0;
  t.published.Publish(nullptr, now_frame, engine_running);
  RecomputeLongestFrames();
}

bool Mixer::track_ready(int track) const {
  if (track < 0 || track >= kMaxTracks) return false;
  return tracks_[track].published.Get() != nullptr;
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
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    if (!t.live_source->is_running()) t.live_source->Start();
    Prime(*t.live_source, t.live_num_frames);
  }
  Enqueue({CommandType::kPlay});
}

void Mixer::Stop() {
  Enqueue({CommandType::kStop});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    t.live_source->Stop();
    t.live_source->Seek(0);
  }
}

void Mixer::Pause() {
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].live_source != nullptr) tracks_[i].live_source->Stop();
  }
}

void Mixer::Seek(uint64_t frame) {
  // The source reposition below is only quiescence-safe while the callback is
  // not draining this source (AudioSource::Seek's contract). Seeking during live
  // playback still repositions in place — the rebuild-and-republish-on-seek path
  // is not shipped yet (tracked in #25). The transport counter is already
  // race-free (A3, race #2, SPEC.md §2.2).
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
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
  return track >= 0 && track < track_count_.load(std::memory_order_relaxed)
             ? tracks_[track].live_num_frames
             : 0;
}

uint64_t Mixer::track_buffered(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return 0;
  }
  const AudioSource* src = tracks_[track].live_source;
  return src != nullptr ? src->buffered_frames() : 0;
}

bool Mixer::track_at_end(int track) const {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return true;
  }
  const AudioSource* src = tracks_[track].live_source;
  return src == nullptr || src->is_at_end();
}

void Mixer::ReleaseRetiredSources() {
  for (auto& track : tracks_) track.published.ReclaimAll();
}

}  // namespace kitbag
