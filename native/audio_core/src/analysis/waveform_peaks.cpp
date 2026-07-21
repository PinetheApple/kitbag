#include "analysis/waveform_peaks.h"

#include <algorithm>
#include <cmath>

namespace kitbag {

namespace {

// Full-scale for signed 16-bit PCM, scaling float samples in [-1, 1].
constexpr float kInt16Max = 32767.0f;

// A malformed file can decode to NaN, +/-inf or values far outside [-1, 1]
// (measured up to 3.19e38). float->int16 of any of those is undefined
// behaviour, so map non-finite to 0 and clamp before the cast — deterministic.
int16_t Quantize(float value) {
  if (!std::isfinite(value)) return 0;
  return static_cast<int16_t>(std::clamp(value, -1.0f, 1.0f) * kInt16Max);
}

void ChunkPeaks(
    const float* pcm,
    int start,
    int end,
    int channels,
    int16_t* out
) {
  for (int ch = 0; ch < channels; ++ch) {
    float min_val = 1.0f;
    float max_val = -1.0f;
    for (int s = start + ch; s < end; s += channels) {
      if (pcm[s] < min_val) min_val = pcm[s];
      if (pcm[s] > max_val) max_val = pcm[s];
    }
    out[ch * 2] = Quantize(min_val);
    out[ch * 2 + 1] = Quantize(max_val);
  }
}

}  // namespace

WaveformPeaks ComputeWaveformPeaks(
    const float* pcm,
    int num_frames,
    int channels,
    int target_chunks
) {
  WaveformPeaks result;
  if (num_frames <= 0 || channels <= 0 || target_chunks <= 0) {
    return result;
  }

  const int chunk_size = std::max(1, num_frames / target_chunks);
  const int actual_chunks = num_frames / chunk_size;

  result.data.resize(static_cast<size_t>(actual_chunks) * channels * 2);
  result.channels = channels;
  result.chunk_count = actual_chunks;
  result.total_frames = num_frames;

  for (int c = 0; c < actual_chunks; ++c) {
    const int start = c * chunk_size * channels;
    const int end =
        std::min(start + chunk_size * channels, num_frames * channels);
    ChunkPeaks(pcm, start, end, channels, &result.data[c * channels * 2]);
  }

  return result;
}

}  // namespace kitbag
