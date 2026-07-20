#include "mixer/mixer.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace kitbag {

void Mixer::SetTrackData(
    int track,
    const float* pcm,
    uint64_t num_frames,
    uint32_t channels,
    uint32_t sample_rate
) {
  if (track < 0 || track >= kMaxTracks) return;

  Track& t = tracks_[track];
  t.pcm.assign(pcm, pcm + num_frames * channels);
  t.channels = channels;
  t.sample_rate = sample_rate;
  t.num_frames = num_frames;
  t.has_data = true;
  if (track >= track_count_) {
    track_count_ = track + 1;
  }
  longest_frames_ = std::max(longest_frames_, num_frames);
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

float Mixer::Gain(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].gain.load(std::memory_order_relaxed)
             : 0.0f;
}

bool Mixer::Muted(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].mute.load(std::memory_order_relaxed)
             : false;
}

bool Mixer::Soloed(int track) const {
  return track >= 0 && track < track_count_
             ? tracks_[track].solo.load(std::memory_order_relaxed)
             : false;
}

void Mixer::Play() {
  playing_.store(true, std::memory_order_release);
}
void Mixer::Stop() {
  playing_.store(false, std::memory_order_release);
  read_frame_.store(0, std::memory_order_relaxed);
}

void Mixer::Pause() {
  playing_.store(false, std::memory_order_release);
}

void Mixer::Seek(uint64_t frame) {
  read_frame_.store(frame, std::memory_order_relaxed);
}

uint64_t Mixer::track_frames(int track) const {
  return track >= 0 && track < track_count_ ? tracks_[track].num_frames : 0;
}

void Mixer::MixMono(
    const Track& tr,
    float* output,
    uint64_t start_frame,
    uint64_t frames,
    float gain
) {
  for (uint64_t f = 0; f < frames; ++f) {
    const uint64_t src_idx = start_frame + f;
    if (src_idx >= tr.num_frames) break;
    const float s = tr.pcm[src_idx] * gain;
    output[2 * f] += s;
    output[2 * f + 1] += s;
  }
}

void Mixer::MixStereo(
    const Track& tr,
    float* output,
    uint64_t start_frame,
    uint64_t frames,
    float gain
) {
  for (uint64_t f = 0; f < frames; ++f) {
    const uint64_t src_idx = (start_frame + f) * tr.channels;
    if (src_idx + 1 >= tr.pcm.size()) break;
    output[2 * f] += tr.pcm[src_idx] * gain;
    output[2 * f + 1] += tr.pcm[src_idx + 1] * gain;
  }
}

void Mixer::MixTrack(
    const Track& tr,
    float* output,
    uint32_t frame_count,
    uint64_t start_frame,
    bool any_solo,
    uint32_t sr
) {
  if (!tr.has_data) return;
  if (any_solo && !tr.solo.load(std::memory_order_relaxed)) return;
  if (tr.mute.load(std::memory_order_relaxed)) return;

  const float gain = tr.gain.load(std::memory_order_relaxed);
  if (gain <= 0.0f) return;

  // No resampler yet — a track at another rate is dropped silently
  // (SPEC.md §4.1).
  if (tr.sample_rate != sr) return;

  const uint64_t frames_avail =
      std::min(
          tr.num_frames,
          start_frame + static_cast<uint64_t>(frame_count)
      ) -
      std::min(start_frame, tr.num_frames);
  if (frames_avail == 0) return;

  if (tr.channels == 1) {
    MixMono(tr, output, start_frame, frames_avail, gain);
  } else if (tr.channels >= 2) {
    MixStereo(tr, output, start_frame, frames_avail, gain);
  }
}

void Mixer::Process(float* output, uint32_t frame_count, uint32_t sr) {
  // Memset, not accumulate: Engine::Render relies on this clearing whatever it
  // wrote before the call.
  std::memset(output, 0, frame_count * 2 * sizeof(float));
  if (!playing_.load(std::memory_order_acquire)) return;

  const bool any_solo = any_solo_.load(std::memory_order_relaxed);
  const uint64_t start_frame = read_frame_.load(std::memory_order_relaxed);

  for (int t = 0; t < track_count_; ++t) {
    MixTrack(tracks_[t], output, frame_count, start_frame, any_solo, sr);
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
