#include "mixer/mixer.h"

#include <algorithm>
#include <chrono>
#include <cstring>
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

bool Mixer::ConfigureTrack(Track& t, SourceReader* base, int track) {
  t.source.Close();
  t.resampler.reset();
  // Resample on load so the ring — and Process — only ever see engine-rate
  // frames (SPEC.md §4.1). num_frames is the resampled length, which is what
  // drives the transport.
  SourceReader* reader = base;
  const uint32_t rate = base->sample_rate();
  if (rate != 0 && rate != engine_rate_) {
    auto rs = std::make_unique<ResamplingSourceReader>(base, engine_rate_);
    if (!rs->ok()) return false;
    t.resampler = std::move(rs);
    reader = t.resampler.get();
  }
  t.channels = reader->channels();
  t.num_frames = reader->total_frames();
  if (!t.source.Open(reader)) return false;
  t.has_data = true;
  if (track >= track_count_) track_count_ = track + 1;
  longest_frames_ = std::max(longest_frames_, t.num_frames);
  EnsureScratch(t.channels);
  return true;
}

void Mixer::SetTrackData(
    int track,
    const float* pcm,
    uint64_t num_frames,
    uint32_t channels,
    uint32_t sample_rate
) {
  if (track < 0 || track >= kMaxTracks) return;
  auto reader =
      std::make_unique<PcmSourceReader>(pcm, num_frames, channels, sample_rate);
  if (!ConfigureTrack(tracks_[track], reader.get(), track)) return;
  tracks_[track].owned_reader = std::move(reader);
}

bool Mixer::SetTrackSource(int track, SourceReader* reader) {
  if (track < 0 || track >= kMaxTracks || reader == nullptr) return false;
  if (!ConfigureTrack(tracks_[track], reader, track)) return false;
  tracks_[track].owned_reader.reset();
  return true;
}

void Mixer::EnsureScratch(uint32_t channels) {
  if (channels <= scratch_channels_) return;
  scratch_channels_ = channels;
  scratch_.assign(static_cast<size_t>(kMaxBlockFrames) * channels, 0.0f);
}

void Mixer::SetGain(int track, float gain) {
  if (track < 0 || track >= track_count_) return;
  tracks_[track].gain.store(
      std::clamp(gain, kMinGain, kMaxGain),
      std::memory_order_relaxed
  );
}

void Mixer::SetMute(int track, bool muted) {
  if (track < 0 || track >= track_count_) return;
  tracks_[track].mute.store(muted, std::memory_order_relaxed);
}

void Mixer::SetSolo(int track, bool soloed) {
  if (track < 0 || track >= track_count_) return;
  tracks_[track].solo.store(soloed, std::memory_order_relaxed);
  bool any = false;
  for (int i = 0; i < track_count_; ++i) {
    if (tracks_[i].has_data &&
        tracks_[i].solo.load(std::memory_order_relaxed)) {
      any = true;
      break;
    }
  }
  any_solo_.store(any, std::memory_order_relaxed);
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

void Mixer::Prime(Track& t) {
  if (!t.has_data) return;
  const uint64_t pos = t.source.position();
  const uint64_t remaining = t.num_frames > pos ? t.num_frames - pos : 0;
  const uint64_t target = std::min(remaining, kPrimeAheadFrames);
  const auto deadline = std::chrono::steady_clock::now() + kPrimeTimeout;
  while (t.source.buffered_frames() < target && !t.source.is_at_end()) {
    if (std::chrono::steady_clock::now() > deadline) break;
    std::this_thread::sleep_for(kPrimePoll);
  }
}

void Mixer::Play() {
  for (int i = 0; i < track_count_; ++i) {
    Track& t = tracks_[i];
    if (!t.has_data) continue;
    if (!t.source.is_running()) t.source.Start();
    Prime(t);
  }
  playing_.store(true, std::memory_order_release);
}

void Mixer::Stop() {
  playing_.store(false, std::memory_order_release);
  read_frame_.store(0, std::memory_order_relaxed);
  for (int i = 0; i < track_count_; ++i) {
    if (!tracks_[i].has_data) continue;
    tracks_[i].source.Stop();
    tracks_[i].source.Seek(0);
  }
}

void Mixer::Pause() {
  playing_.store(false, std::memory_order_release);
  for (int i = 0; i < track_count_; ++i) {
    if (tracks_[i].has_data) tracks_[i].source.Stop();
  }
}

void Mixer::Seek(uint64_t frame) {
  read_frame_.store(frame, std::memory_order_relaxed);
  for (int i = 0; i < track_count_; ++i) {
    Track& t = tracks_[i];
    if (!t.has_data) continue;
    const bool was_running = t.source.is_running();
    t.source.Stop();
    // Clamp past a short stem's end so it seeks to end (silent) rather than
    // refusing and desyncing from the transport.
    t.source.Seek(std::min(frame, t.num_frames));
    if (!was_running) continue;
    t.source.Start();
    Prime(t);
  }
}

uint64_t Mixer::track_frames(int track) const {
  return track >= 0 && track < track_count_ ? tracks_[track].num_frames : 0;
}

uint64_t Mixer::track_buffered(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].source.buffered_frames()
             : 0;
}

bool Mixer::track_at_end(int track) const {
  return track < 0 || track >= track_count_ ||
         tracks_[track].source.is_at_end();
}

void Mixer::MixMono(
    const float* src,
    float* output,
    uint32_t frames,
    float gain
) {
  for (uint32_t f = 0; f < frames; ++f) {
    const float s = src[f] * gain;
    output[2 * f] += s;
    output[2 * f + 1] += s;
  }
}

void Mixer::MixStereo(
    const float* src,
    uint32_t channels,
    float* output,
    uint32_t frames,
    float gain
) {
  for (uint32_t f = 0; f < frames; ++f) {
    output[2 * f] += src[f * channels] * gain;
    output[2 * f + 1] += src[f * channels + 1] * gain;
  }
}

void Mixer::MixTrack(
    Track& tr,
    float* output,
    uint32_t frame_count,
    bool any_solo
) {
  if (!tr.has_data) return;

  // Drain first and unconditionally: a muted or soloed-out track must still
  // advance so unmuting resumes in sync rather than replaying (SPEC.md §4.4).
  const uint32_t got = tr.source.Read(scratch_.data(), frame_count);
  if (any_solo && !tr.solo.load(std::memory_order_relaxed)) return;
  if (tr.mute.load(std::memory_order_relaxed)) return;
  const float gain = tr.gain.load(std::memory_order_relaxed);
  if (gain <= 0.0f) return;

  if (tr.channels == 1) {
    MixMono(scratch_.data(), output, got, gain);
  } else if (tr.channels >= 2) {
    MixStereo(scratch_.data(), tr.channels, output, got, gain);
  }
}

void Mixer::Process(float* output, uint32_t frame_count) {
  // Memset, not accumulate: Engine::Render relies on this clearing whatever it
  // wrote before the call.
  std::memset(output, 0, frame_count * 2 * sizeof(float));
  if (!playing_.load(std::memory_order_acquire)) return;
  // Scratch is sized to kMaxBlockFrames at setup; a wider block cannot be
  // drained without allocating, which the callback must never do.
  if (frame_count > kMaxBlockFrames) return;

  const bool any_solo = any_solo_.load(std::memory_order_relaxed);
  const uint64_t start_frame = read_frame_.load(std::memory_order_relaxed);

  for (int t = 0; t < track_count_; ++t) {
    MixTrack(tracks_[t], output, frame_count, any_solo);
  }

  // The transport is the longest loaded track, not what was audible: mute, solo
  // and zero gain must not end playback (SPEC.md §4.4).
  if (start_frame >= longest_frames_) {
    playing_.store(false, std::memory_order_release);
    return;
  }
  const uint64_t remaining = longest_frames_ - start_frame;
  read_frame_.store(
      start_frame + std::min(static_cast<uint64_t>(frame_count), remaining),
      std::memory_order_relaxed
  );
}

}  // namespace kitbag
