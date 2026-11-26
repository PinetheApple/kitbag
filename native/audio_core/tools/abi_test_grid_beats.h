#ifndef KITBAG_TOOLS_ABI_TEST_GRID_BEATS_H
#define KITBAG_TOOLS_ABI_TEST_GRID_BEATS_H

#include <vector>

namespace abi_test {

// Half a sample in keeps every beat off a rounding boundary.
inline std::vector<double> GridBeats(
    double sample_rate,
    double first_sec,
    double interval_sec,
    int count
) {
  std::vector<double> beats;
  beats.reserve(static_cast<size_t>(count));
  for (int i = 0; i < count; ++i) {
    beats.push_back(first_sec + interval_sec * i + 0.5 / sample_rate);
  }
  return beats;
}

}  // namespace abi_test

#endif  // KITBAG_TOOLS_ABI_TEST_GRID_BEATS_H
