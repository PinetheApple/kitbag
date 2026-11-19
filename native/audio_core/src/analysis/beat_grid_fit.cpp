#include "analysis/beat_grid_fit.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <utility>

#include "analysis/beat_tracker.h"

namespace kitbag {

namespace {

constexpr size_t kMaxSlopePoints = 256;
constexpr size_t kMinBeatsForSlope = 2;
constexpr double kSecondsPerMinute = 60.0;

double Median(std::vector<double> values) {
  const auto mid =
      values.begin() + static_cast<std::ptrdiff_t>(values.size() / 2);
  std::nth_element(values.begin(), mid, values.end());
  return *mid;
}

std::vector<double> SkipAwareNumbers(const std::vector<float>& beats) {
  std::vector<double> intervals;
  intervals.reserve(beats.size() - 1);
  for (size_t k = 1; k < beats.size(); ++k) {
    intervals.push_back(static_cast<double>(beats[k]) - beats[k - 1]);
  }
  const double typical = Median(intervals);
  std::vector<double> numbers(beats.size(), 0.0);
  for (size_t k = 1; k < beats.size(); ++k) {
    const double periods = std::round(intervals[k - 1] / typical);
    numbers[k] = numbers[k - 1] + std::max(1.0, periods);
  }
  return numbers;
}

size_t SlopeStride(size_t beat_count) {
  return (beat_count + kMaxSlopePoints - 1) / kMaxSlopePoints;
}

double MedianSlope(const std::vector<float>& beats, const BeatGridLine& line) {
  const size_t stride = SlopeStride(beats.size());
  const size_t points = (beats.size() + stride - 1) / stride;
  std::vector<double> slopes;
  slopes.reserve(points * (points - 1) / 2);
  for (size_t i = 0; i < beats.size(); i += stride) {
    for (size_t j = i + stride; j < beats.size(); j += stride) {
      const double rise = static_cast<double>(beats[j]) - beats[i];
      slopes.push_back(rise / (line.numbers[j] - line.numbers[i]));
    }
  }
  return Median(std::move(slopes));
}

double
MedianIntercept(const std::vector<float>& beats, const BeatGridLine& line) {
  const size_t stride = SlopeStride(beats.size());
  std::vector<double> intercepts;
  intercepts.reserve((beats.size() + stride - 1) / stride);
  for (size_t i = 0; i < beats.size(); i += stride) {
    intercepts.push_back(beats[i] - line.period * line.numbers[i]);
  }
  return Median(std::move(intercepts));
}

}  // namespace

BeatGridLine FitBeatGrid(const std::vector<float>& beats) {
  BeatGridLine line;
  if (beats.size() < kMinBeatsForSlope) return line;
  line.numbers = SkipAwareNumbers(beats);
  line.period = MedianSlope(beats, line);
  line.intercept = MedianIntercept(beats, line);
  return line;
}

float BeatGridBpm(const std::vector<float>& beats) {
  const double period = FitBeatGrid(beats).period;
  if (period <= 0.0) return 0.0f;
  return static_cast<float>(kSecondsPerMinute / period);
}

}  // namespace kitbag
