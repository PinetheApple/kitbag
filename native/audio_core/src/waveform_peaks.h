#ifndef KITBAG_WAVEFORM_PEAKS_H
#define KITBAG_WAVEFORM_PEAKS_H

#include <cstdint>
#include <vector>

namespace kitbag {

struct WaveformPeaks {
  std::vector<int16_t> data;  // interleaved [ch0_min, ch0_max, ch1_min, ...]
  int channels = 0;
  int chunk_count = 0;
  int64_t total_frames = 0;
};

/// Reduces interleaved PCM to per-channel min/max pairs over `target_chunks`
/// equal spans. Offline, app thread — it allocates.
WaveformPeaks ComputeWaveformPeaks(
    const float* pcm,
    int num_frames,
    int channels,
    int target_chunks
);

}  // namespace kitbag

#endif  // KITBAG_WAVEFORM_PEAKS_H
