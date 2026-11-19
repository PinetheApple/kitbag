#ifndef KITBAG_ANALYSIS_BEAT_GRID_FIT_H
#define KITBAG_ANALYSIS_BEAT_GRID_FIT_H

#include <vector>

namespace kitbag {

/// Counted beat k is at times[k], fitted at intercept_sec + numbers[k] * period_sec.
struct BeatGridLine {
  double period_sec = 0.0;
  double intercept_sec = 0.0;
  std::vector<double> times;
  std::vector<double> numbers;
};

/// BeatGridBpm's fit: Theil-Sen over beats numbered by whole periods elapsed.
BeatGridLine FitBeatGrid(const std::vector<float>& beats);

/// kb_fit_constant_tempo's fit, counting beats as StemDeck's number_beats.
BeatGridLine FitCountedBeats(const std::vector<float>& beats);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BEAT_GRID_FIT_H
