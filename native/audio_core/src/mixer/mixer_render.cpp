// The realtime half of the mixer: the command drain and the per-block mix. Runs
// entirely on the audio callback — allocates nothing, takes no lock, frees
// nothing. Setup and transport live in mixer.cpp.
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
      playing_.store(false, std::memory_order_relaxed);
      read_frame_.store(0, std::memory_order_relaxed);
      return;
    case CommandType::kPause:
      playing_.store(false, std::memory_order_relaxed);
      return;
    case CommandType::kSeek:
      read_frame_.store(command.frame, std::memory_order_relaxed);
      return;
  }
}

void Mixer::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) ApplyCommand(command);
}

void Mixer::RecomputeAnySolo() {
  bool any = false;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].published.Get() != nullptr &&
        tracks_[i].solo.load(std::memory_order_relaxed)) {
      any = true;
      break;
    }
  }
  any_solo_.store(any, std::memory_order_relaxed);
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
    const TrackSource* src,
    float* output,
    uint32_t frame_count,
    bool any_solo
) {
  if (src == nullptr) return;

  // Drain first and unconditionally: a muted or soloed-out track must still
  // advance so unmuting resumes in sync rather than replaying (SPEC.md §4.4).
  const uint32_t got = src->source->Read(scratch_.data(), frame_count);
  if (any_solo && !tr.solo.load(std::memory_order_relaxed)) return;
  if (tr.mute.load(std::memory_order_relaxed)) return;
  const float gain = tr.gain.load(std::memory_order_relaxed);
  if (gain <= 0.0f) return;

  if (src->channels == 1) {
    MixMono(scratch_.data(), output, got, gain);
  } else if (src->channels >= 2) {
    MixStereo(scratch_.data(), src->channels, output, got, gain);
  }
}

void Mixer::MixAllTracks(float* output, uint32_t frame_count, bool any_solo) {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    // One acquire load per track carries the source and its identity; the old
    // source is never freed here, only off-thread once the clock moves past it.
    const auto* node = tracks_[t].published.Get();
    MixTrack(
        tracks_[t],
        node != nullptr ? &node->value : nullptr,
        output,
        frame_count,
        any_solo
    );
  }
}

void Mixer::AdvanceTransport(uint64_t start_frame, uint32_t frame_count) {
  // The transport is the longest loaded track, not what was audible: mute, solo
  // and zero gain must not end playback (SPEC.md §4.4).
  const uint64_t longest = longest_frames_.load(std::memory_order_relaxed);
  if (start_frame >= longest) {
    playing_.store(false, std::memory_order_relaxed);
    return;
  }
  const uint64_t remaining = longest - start_frame;
  read_frame_.store(
      start_frame + std::min(static_cast<uint64_t>(frame_count), remaining),
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
  // Scratch is sized to kMaxBlockFrames at setup; a wider block cannot be
  // drained without allocating, which the callback must never do.
  if (frame_count > kMaxBlockFrames) return;
  if (!playing_.load(std::memory_order_relaxed)) return;

  const bool any_solo = any_solo_.load(std::memory_order_relaxed);
  const uint64_t start_frame = read_frame_.load(std::memory_order_relaxed);
  MixAllTracks(output, frame_count, any_solo);
  AdvanceTransport(start_frame, frame_count);
}

}  // namespace kitbag
