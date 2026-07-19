#ifndef KITBAG_BEAT_TRACKER_H
#define KITBAG_BEAT_TRACKER_H

#include <vector>

namespace kitbag {

struct BeatResult {
  float bpm = 0.0f;
  std::vector<float> beat_times;  // seconds
};

/// Beat tracker using spectral flux onset detection + autocorrelation
/// tempo estimation + dynamic programming beat placement.
class BeatTracker {
 public:
  /// Analyze mono PCM data at the given sample rate.
  /// Returns detected BPM and beat times in seconds.
  BeatResult Analyze(const float* pcm, int num_frames, int sample_rate);

  /// Places beats over an onset envelope by dynamic programming.
  /// Public so beat_tracker_verify can drive it with a synthetic envelope —
  /// reaching it through Analyze() would mean synthesising ~17 minutes of PCM.
  std::vector<float>
  TrackBeats(const std::vector<float>& onset, float hop_time, float bpm);

 private:
  std::vector<float> ComputeOnsetFunction(const float* pcm, int num_frames);

  float EstimateTempo(const std::vector<float>& onset, float hop_time);
};

}  // namespace kitbag

#endif  // KITBAG_BEAT_TRACKER_H
