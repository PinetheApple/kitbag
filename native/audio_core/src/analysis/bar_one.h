#ifndef KITBAG_ANALYSIS_BAR_ONE_H
#define KITBAG_ANALYSIS_BAR_ONE_H

#include <vector>

namespace kitbag {

// A stand-out beat raises the change into and out of it alike, so QM's maximum
// lands on it or the beat after; this returns that beat, else qm_phase.
int BarOnePhase(const std::vector<double>& beat_sd, int timesig, int qm_phase);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_BAR_ONE_H
