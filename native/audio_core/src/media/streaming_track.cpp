// The shared streaming transport behind Mixer and Player: setup, off-thread
// publish, the #25 rebuild-and-swap seek, and the realtime drain/mix. Extracted
// so the two are one implementation rather than a hand-copy.
#include "media/streaming_track.h"

#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>

#include "media/file_audio_reader.h"
#include "media/resampling_source_reader.h"

namespace kitbag {
namespace {

// How far ahead the setup path buffers before playback: one max block, inside
// the source ring so it is always reachable.
constexpr uint64_t kPrimeAheadFrames = StreamingTrack::kMaxBlockFrames;
constexpr auto kPrimeTimeout = std::chrono::seconds(2);
constexpr auto kPrimePoll = std::chrono::milliseconds(1);

}  // namespace

bool StreamingTrack::BuildSource(Source& s, SourceReader* base) {
  // Resample on load so the ring — and the drain — only ever see engine-rate
  // frames (SPEC.md §4.1). num_frames is the resampled length.
  SourceReader* reader = base;
  const uint32_t rate = base->sample_rate();
  if (rate != 0 && rate != engine_rate_) {
    auto rs = std::make_unique<ResamplingSourceReader>(base, engine_rate_);
    if (!rs->ok()) return false;
    s.resampler = std::move(rs);
    reader = s.resampler.get();
  }
  s.channels = reader->channels();
  // Callers size scratch to kMaxChannels once and never grow it, so a wider
  // source would overrun it under a concurrent drain. Reject at load.
  if (s.channels == 0 || s.channels > kMaxChannels) return false;
  s.num_frames = reader->total_frames();
  s.source = std::make_unique<AudioSource>();
  return s.source->Open(reader);
}

void StreamingTrack::Publish(
    std::unique_ptr<Source> s,
    uint64_t now_frame,
    bool engine_running
) {
  // The source pointee survives the move into the publisher node, so this raw
  // handle stays valid for the off-thread transport work.
  live_source_ = s->source.get();
  live_num_frames_ = s->num_frames;
  num_frames_.store(s->num_frames, std::memory_order_relaxed);
  published_.Publish(std::move(s), now_frame, engine_running);
}

bool StreamingTrack::Load(
    const char* path,
    uint64_t now_frame,
    bool engine_running
) {
  if (path == nullptr) return false;
  auto reader = std::make_unique<FileAudioReader>();
  if (!reader->Open(path)) return false;
  auto s = std::make_unique<Source>();
  if (!BuildSource(*s, reader.get())) return false;
  s->owned_reader = std::move(reader);
  load_path_ = path;
  ext_reader_ = nullptr;
  Publish(std::move(s), now_frame, engine_running);
  return true;
}

bool StreamingTrack::LoadReader(
    SourceReader* reader,
    uint64_t now_frame,
    bool engine_running
) {
  if (reader == nullptr) return false;
  auto s = std::make_unique<Source>();
  if (!BuildSource(*s, reader)) return false;
  // owned_reader stays null: the caller owns `reader` and must outlive the track.
  ext_reader_ = reader;
  load_path_.clear();
  Publish(std::move(s), now_frame, engine_running);
  return true;
}

void StreamingTrack::Unload(uint64_t now_frame, bool engine_running) {
  // Stop the read-ahead thread now; the node itself is reclaimed off the
  // callback by the publisher, so nothing is freed on the audio thread.
  if (live_source_ != nullptr) live_source_->Stop();
  live_source_ = nullptr;
  live_num_frames_ = 0;
  load_path_.clear();
  ext_reader_ = nullptr;
  num_frames_.store(0, std::memory_order_relaxed);
  published_.Publish(nullptr, now_frame, engine_running);
}

void StreamingTrack::Prime(AudioSource& src, uint64_t num_frames) {
  const uint64_t pos = src.position();
  const uint64_t remaining = num_frames > pos ? num_frames - pos : 0;
  const uint64_t target = std::min(remaining, kPrimeAheadFrames);
  const auto deadline = std::chrono::steady_clock::now() + kPrimeTimeout;
  while (src.buffered_frames() < target && !src.is_at_end()) {
    if (std::chrono::steady_clock::now() > deadline) break;
    std::this_thread::sleep_for(kPrimePoll);
  }
}

void StreamingTrack::StartAndPrime() {
  if (live_source_ == nullptr) return;
  if (!live_source_->is_running()) live_source_->Start();
  Prime(*live_source_, live_num_frames_);
}

void StreamingTrack::StopSource() {
  if (live_source_ != nullptr) live_source_->Stop();
}

std::unique_ptr<StreamingTrack::Source> StreamingTrack::BuildReseekSource(
    uint64_t target
) {
  auto s = std::make_unique<Source>();
  if (!load_path_.empty()) {
    auto reader = std::make_unique<FileAudioReader>();
    if (!reader->Open(load_path_.c_str())) return nullptr;
    if (!BuildSource(*s, reader.get())) return nullptr;
    s->owned_reader = std::move(reader);
  } else if (ext_reader_ != nullptr) {
    if (!BuildSource(*s, ext_reader_)) return nullptr;
  } else {
    return nullptr;
  }
  if (!s->source->Seek(target) || !s->source->Start()) return nullptr;
  Prime(*s->source, s->num_frames);
  return s;
}

bool StreamingTrack::ReseekLive(
    uint64_t frame,
    uint64_t now_frame,
    bool engine_running
) {
  const uint64_t target = std::min(frame, live_num_frames_);
  // Stop the old read-ahead thread first so the reader is untouched while the
  // fresh source is built; the callback keeps draining the old ring meanwhile.
  live_source_->Stop();
  auto s = BuildReseekSource(target);
  if (s == nullptr) {
    live_source_->Start();  // rebuild failed: resume the old source in place
    return false;
  }
  Publish(std::move(s), now_frame, engine_running);
  return true;
}

void StreamingTrack::RewindForStop(uint64_t now_frame, bool engine_running) {
  if (live_source_ == nullptr) return;
  if (engine_running) {
    // Device live: a callback that loaded playing_==true can be inside Read on
    // this ring, so rewind by rebuild-and-swap, never an in-place Clear (#25).
    ReseekLive(0, now_frame, engine_running);
  } else {
    live_source_->Stop();
    live_source_->Seek(0);
  }
}

bool StreamingTrack::Seek(
    uint64_t frame,
    uint64_t now_frame,
    bool engine_running
) {
  if (live_source_ == nullptr) return true;
  if (engine_running || live_source_->is_running()) {
    // Rebuild whenever either side is live: the device may be draining this ring
    // (pause leaves is_running() false a block early — #25), or the read-ahead
    // thread is running and AudioSource::Seek refuses it.
    return ReseekLive(frame, now_frame, engine_running);
  }
  // Device stopped and the source idle — the only truly quiescent state, so the
  // in-place Clear races nothing. Clamp a seek past the end.
  live_source_->Seek(std::min(frame, live_num_frames_));
  return true;
}

uint32_t StreamingTrack::DrainBlock(
    float* scratch,
    uint32_t frame_count,
    uint32_t* channels
) const {
  const auto* node = published_.Get();
  if (node == nullptr) {
    *channels = 0;
    return 0;
  }
  *channels = node->value.channels;
  return node->value.source->Read(scratch, frame_count);
}

void StreamingTrack::AddToOutput(
    const float* scratch,
    uint32_t channels,
    uint32_t frames,
    float* output,
    float gain
) {
  if (channels == 1) {
    for (uint32_t f = 0; f < frames; ++f) {
      const float s = scratch[f] * gain;
      output[2 * f] += s;
      output[2 * f + 1] += s;
    }
  } else if (channels >= 2) {
    for (uint32_t f = 0; f < frames; ++f) {
      output[2 * f] += scratch[f * channels] * gain;
      output[2 * f + 1] += scratch[f * channels + 1] * gain;
    }
  }
}

}  // namespace kitbag
