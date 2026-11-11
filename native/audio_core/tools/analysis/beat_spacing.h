#ifndef KITBAG_TOOLS_ANALYSIS_BEAT_SPACING_H
#define KITBAG_TOOLS_ANALYSIS_BEAT_SPACING_H

#include <algorithm>
#include <cmath>
#include <vector>

namespace analyze_test {

constexpr double kMinGapPeriods = 0.75;
constexpr double kBpmTolerance = 0.03;

inline double MinGap(const std::vector<float>& beats) {
  double gap = INFINITY;
  for (size_t i = 1; i < beats.size(); ++i) {
    gap = std::min(gap, static_cast<double>(beats[i] - beats[i - 1]));
  }
  return gap;
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_BEAT_SPACING_H
