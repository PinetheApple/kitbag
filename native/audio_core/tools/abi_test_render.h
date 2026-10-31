#ifndef KITBAG_TOOLS_ABI_TEST_RENDER_H
#define KITBAG_TOOLS_ABI_TEST_RENDER_H

#include "kitbag_api.h"

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace abi_test {

inline constexpr uint32_t kChannels = 2;
inline constexpr double kPeakTolerance = 0.05;

inline std::vector<float> Render(kb_engine* engine, uint32_t frames) {
  std::vector<float> out(static_cast<size_t>(frames) * kChannels);
  kb_engine_render(engine, out.data(), frames);
  return out;
}

inline double RenderPeakOf(const std::vector<float>& out) {
  double peak = 0.0;
  for (const float sample : out) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(sample)));
  }
  return peak;
}

inline double RenderPeak(kb_engine* engine, uint32_t frames) {
  return RenderPeakOf(Render(engine, frames));
}

inline bool Near(double actual, double expected) {
  return std::fabs(actual - expected) <= kPeakTolerance;
}

}  // namespace abi_test

#endif  // KITBAG_TOOLS_ABI_TEST_RENDER_H
