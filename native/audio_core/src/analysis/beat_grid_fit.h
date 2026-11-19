#ifndef KITBAG_ANALYSIS_BEAT_GRID_FIT_H
#define KITBAG_ANALYSIS_BEAT_GRID_FIT_H

#include <vector>

namespace kitbag {

/// Beat k sits at intercept + numbers[k] * period; period is 0 for fewer than
/// two beats.
struct BeatGridLine {
  double period = 0.0;
  double intercept = 0.0;
  std::vector<double> numbers;
};

/// Theil-Sen over beats numbered by whole periods elapsed, so a shifted beat
/// is outvoted and a skipped one does not shift every later number.
BeatGridLine FitBeatGrid(const std::vector<float>& beats);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BEAT_GRID_FIT_H
