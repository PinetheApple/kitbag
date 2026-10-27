#ifndef KITBAG_ANALYSIS_BEAT_TRACKER_H
#define KITBAG_ANALYSIS_BEAT_TRACKER_H

#include <vector>

namespace kitbag {

struct BeatResult {
  float bpm = 0.0f;
  std::vector<float> beat_times;  // seconds
  std::vector<int>
      downbeat_indices;  // indices into beat_times that are bar-ones
};

/// Beat tracker using spectral flux onset detection + autocorrelation
/// tempo estimation + dynamic programming beat placement.
class BeatTracker {
 public:
  /// Tempo and beat times in seconds from an OnsetEnvelope's raw flux.
  BeatResult AnalyzeFlux(std::vector<float> flux, int sample_rate);

  /// Places beats over an onset envelope by dynamic programming.
  /// Public so beat_tracker_verify can drive it at a fixed bpm, bypassing tempo
  /// estimation.
  std::vector<float>
  TrackBeats(const std::vector<float>& onset, float hop_time, float bpm);

 private:
  std::vector<float> SmoothOnset(std::vector<float> flux);

  float EstimateTempo(const std::vector<float>& onset, float hop_time);
};

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BEAT_TRACKER_H
