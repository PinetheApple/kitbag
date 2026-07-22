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
  tracks_[track].load_path = path;
  tracks_[track].ext_reader = nullptr;
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
  t.load_path.clear();
  t.ext_reader = nullptr;
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
  tracks_[track].ext_reader = reader;
  tracks_[track].load_path.clear();
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

void Mixer::Stop(uint64_t now_frame, bool engine_running) {
  Enqueue({CommandType::kStop});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    if (engine_running) {
      // Device live: a callback that loaded playing_==true can be inside Read on
      // this ring, so rewind by rebuild-and-swap, never an in-place Clear (#25).
      ReseekLive(i, 0, now_frame, engine_running);
    } else {
      t.live_source->Stop();
      t.live_source->Seek(0);
    }
  }
}

void Mixer::Pause() {
  Enqueue({CommandType::kPause});
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].live_source != nullptr) tracks_[i].live_source->Stop();
  }
}

std::unique_ptr<Mixer::TrackSource>
Mixer::BuildReseekSource(int track, uint64_t target) {
  Track& t = tracks_[track];
  auto ts = std::make_unique<TrackSource>();
  if (!t.load_path.empty()) {
    auto reader = std::make_unique<FileAudioReader>();
    if (!reader->Open(t.load_path.c_str())) return nullptr;
    if (!BuildTrackSource(*ts, reader.get())) return nullptr;
    ts->owned_reader = std::move(reader);
  } else if (t.ext_reader != nullptr) {
    if (!BuildTrackSource(*ts, t.ext_reader)) return nullptr;
  } else {
    return nullptr;
  }
  if (!ts->source->Seek(target) || !ts->source->Start()) return nullptr;
  Prime(*ts->source, ts->num_frames);
  return ts;
}

bool Mixer::ReseekLive(
    int track,
    uint64_t frame,
    uint64_t now_frame,
    bool engine_running
) {
  Track& t = tracks_[track];
  const uint64_t target = std::min(frame, t.live_num_frames);
  // Stop the old read-ahead thread first so the reader is untouched while the
  // fresh source is built; the callback keeps draining the old ring meanwhile.
  t.live_source->Stop();
  auto ts = BuildReseekSource(track, target);
  if (ts == nullptr) {
    t.live_source->Start();  // rebuild failed: resume the old source in place
    return false;
  }
  t.live_source = ts->source.get();
  t.live_num_frames = ts->num_frames;
  t.published.Publish(std::move(ts), now_frame, engine_running);
  return true;
}

void Mixer::Seek(uint64_t frame, uint64_t now_frame, bool engine_running) {
  const int count = track_count_.load(std::memory_order_relaxed);
  bool committed = true;
  for (int i = 0; i < count; ++i) {
    Track& t = tracks_[i];
    if (t.live_source == nullptr) continue;
    if (engine_running || t.live_source->is_running()) {
      // Rebuild whenever either side is live: the device may be draining this
      // ring (Pause/Stop leave is_running() false a block early — #25), or the
      // read-ahead thread is running and AudioSource::Seek refuses it.
      if (!ReseekLive(i, frame, now_frame, engine_running)) committed = false;
    } else {
      // Device stopped and the source idle — the only truly quiescent state, so
      // the in-place Clear races nothing. Clamp past a short stem's end.
      t.live_source->Seek(std::min(frame, t.live_num_frames));
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

uint64_t Mixer::rt_track_buffered(int track) const {
  if (track < 0 || track >= kMaxTracks) return 0;
  const auto* node = tracks_[track].published.Get();
  return node != nullptr ? node->value.source->buffered_frames() : 0;
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
