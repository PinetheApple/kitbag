#ifndef KITBAG_ANALYSIS_CONSTANT_TEMPO_H
#define KITBAG_ANALYSIS_CONSTANT_TEMPO_H

#include <vector>

namespace kitbag {

struct ConstantTempo {
  double bpm = 0.0;
  double anchor_sec = 0.0;
  int beats_per_bar = 0;
};

/// kb_fit_constant_tempo's fit over ascending finite beats and in-range
/// downbeat indices; false when the bpm falls outside the accepted range.
bool FitConstantTempo(
    const std::vector<float>& beats,
    const std::vector<int>& downbeats,
    ConstantTempo* out
);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_CONSTANT_TEMPO_H
