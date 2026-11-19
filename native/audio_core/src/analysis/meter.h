#ifndef KITBAG_ANALYSIS_METER_H
#define KITBAG_ANALYSIS_METER_H

#include <vector>

namespace kitbag {

constexpr int kTripleBeatsPerBar = 3;
constexpr int kCommonBeatsPerBar = 4;

int DetectBeatsPerBar(const std::vector<double>& beat_sd);

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_METER_H
