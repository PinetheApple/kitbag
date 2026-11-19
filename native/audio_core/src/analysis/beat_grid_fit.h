#ifndef KITBAG_ANALYSIS_BEAT_GRID_FIT_H
#define KITBAG_ANALYSIS_BEAT_GRID_FIT_H

#include <vector>

namespace kitbag {

/// Counted beat k sits near intercept + numbers[k] * period, at times[k];
/// period is 0 when fewer than two beats were counted.
struct BeatGridLine {
  double period = 0.0;
  double intercept = 0.0;
  std::vector<double> times;
  std::vector<double> numbers;
};

/// BeatGridBpm's fit: Theil-Sen over every beat, numbered by whole periods
/// elapsed, so a shifted beat is outvoted and a skipped one shifts no number.
BeatGridLine FitBeatGrid(const std::vector<float>& beats);

/// kb_fit_constant_tempo's fit, numbered as StemDeck's number_beats: a beat
/// under 0.75 median periods after the last counted one is not counted.
BeatGridLine FitCountedBeats(const std::vector<float>& beats);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BEAT_GRID_FIT_H
