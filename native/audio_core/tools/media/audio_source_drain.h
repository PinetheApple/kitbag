#ifndef KITBAG_TOOLS_MEDIA_AUDIO_SOURCE_DRAIN_H
#define KITBAG_TOOLS_MEDIA_AUDIO_SOURCE_DRAIN_H

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <thread>
#include <vector>

#include "media/audio_source.h"
#include "media_test_support.h"

namespace media_test {

struct DrainResult {
  uint64_t frames = 0;
  bool integrity = true;
  bool zero_fill = true;
  bool timed_out = false;
};

// The ramp makes every sample its own absolute index, so this catches a
// duplicated or dropped span that a frame count alone would balance out.
inline void VerifyBlock(
    const std::vector<float>& dst,
    size_t delivered,
    uint64_t cursor,
    DrainResult* result
) {
  for (size_t i = 0; i < delivered; ++i) {
    if (dst[i] != static_cast<float>(cursor + i)) result->integrity = false;
  }
  for (size_t i = delivered; i < dst.size(); ++i) {
    if (dst[i] != 0.0F) result->zero_fill = false;
  }
}

// Reads `block` frames at a time until the source reports end of stream.
// `start_sample` is the ramp value the first sample should carry.
inline DrainResult
Drain(kitbag::AudioSource* source, uint32_t block, uint64_t start_sample) {
  const uint32_t channels = source->channels();
  std::vector<float> dst(static_cast<size_t>(block) * channels);
  DrainResult result;
  uint64_t cursor = start_sample;
  const auto deadline = std::chrono::steady_clock::now() + kWaitTimeout;
  while (!source->is_at_end()) {
    if (std::chrono::steady_clock::now() > deadline) {
      result.timed_out = true;
      break;
    }
    std::fill(dst.begin(), dst.end(), kPoison);
    const size_t delivered =
        static_cast<size_t>(source->Read(dst.data(), block)) * channels;
    VerifyBlock(dst, delivered, cursor, &result);
    cursor += delivered;
    if (delivered == 0) std::this_thread::sleep_for(kPollInterval);
  }
  result.frames = (cursor - start_sample) / channels;
  return result;
}

// Reads exactly `frames` frames, retrying while the ring refills. Returns
// false on timeout or on a sample that does not match the ramp.
inline bool ReadExactly(
    kitbag::AudioSource* source,
    uint32_t frames,
    uint64_t start_sample
) {
  const uint32_t channels = source->channels();
  std::vector<float> dst(static_cast<size_t>(frames) * channels);
  uint64_t cursor = start_sample;
  uint32_t remaining = frames;
  const auto deadline = std::chrono::steady_clock::now() + kWaitTimeout;
  while (remaining > 0) {
    if (std::chrono::steady_clock::now() > deadline) return false;
    std::fill(dst.begin(), dst.end(), kPoison);
    const uint32_t got = source->Read(dst.data(), remaining);
    for (size_t i = 0; i < static_cast<size_t>(got) * channels; ++i) {
      if (dst[i] != static_cast<float>(cursor + i)) return false;
    }
    cursor += static_cast<uint64_t>(got) * channels;
    remaining -= got;
    if (got == 0) std::this_thread::sleep_for(kPollInterval);
  }
  return true;
}

}  // namespace media_test

#endif  // KITBAG_TOOLS_MEDIA_AUDIO_SOURCE_DRAIN_H
