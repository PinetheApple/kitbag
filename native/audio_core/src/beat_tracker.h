#ifndef KITBAG_BEAT_TRACKER_H
#define KITBAG_BEAT_TRACKER_H

#include <cstdint>
#include <vector>

namespace kitbag {

struct BeatResult {
  float bpm = 0.0f;
  std::vector<float> beat_times;  // seconds
};

struct WaveformPeaks {
  std::vector<int16_t> data;  // interleaved [ch0_min, ch0_max, ch1_min, ...]
  int channels = 0;
  int chunk_count = 0;
  int64_t total_frames = 0;
};

/// Beat tracker using spectral flux onset detection + autocorrelation
/// tempo estimation + dynamic programming beat placement.
class BeatTracker {
 public:
  /// Analyze mono PCM data at the given sample rate.
  /// Returns detected BPM and beat times in seconds.
  BeatResult Analyze(const float* pcm, int num_frames, int sample_rate);

  /// Generate waveform peaks from interleaved PCM data.
  /// target_chunks: desired number of min/max pairs (~2000).
  static WaveformPeaks ComputeWaveformPeaks(const float* pcm, int num_frames,
                                            int channels, int target_chunks);

 private:
  std::vector<float> ComputeOnsetFunction(const float* pcm, int num_frames);

  float EstimateTempo(const std::vector<float>& onset, float hop_time);

  std::vector<float> TrackBeats(const std::vector<float>& onset, float hop_time,
                                float bpm);
};

}  // namespace kitbag

#endif  // KITBAG_BEAT_TRACKER_H
