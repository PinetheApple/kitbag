#ifndef KITBAG_ANALYSIS_METER_H
#define KITBAG_ANALYSIS_METER_H

#include <vector>

namespace kitbag {

constexpr int kWaltzBeatsPerBar = 3;
constexpr int kCommonBeatsPerBar = 4;

// beat_sd[i] is the spectral difference into beat i + 1. The best phase's
// mean minus the other phases' mean, over the mean of all; 0 when undefined.
double BarContrast(const std::vector<double>& beat_sd, int beats_per_bar);

int DetectBeatsPerBar(const std::vector<double>& beat_sd);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_METER_H
