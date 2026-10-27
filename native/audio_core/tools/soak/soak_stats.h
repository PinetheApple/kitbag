#ifndef KITBAG_TOOLS_SOAK_SOAK_STATS_H
#define KITBAG_TOOLS_SOAK_SOAK_STATS_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace click_soak {

template <typename T>
double Quantile(std::vector<T> values, double fraction) {
  if (values.empty()) return 0.0;
  const auto rank = static_cast<size_t>(
      std::ceil(fraction * static_cast<double>(values.size()))
  );
  const size_t index = std::min(values.size() - 1, rank > 0 ? rank - 1 : 0);
  std::nth_element(values.begin(), values.begin() + index, values.end());
  return static_cast<double>(values[index]);
}

template <typename T>
double UpperMedian(std::vector<T> values) {
  if (values.empty()) return 0.0;
  const size_t index = values.size() / 2;
  std::nth_element(values.begin(), values.begin() + index, values.end());
  return static_cast<double>(values[index]);
}

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_SOAK_STATS_H
