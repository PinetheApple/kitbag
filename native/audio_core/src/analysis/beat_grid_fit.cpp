#include "kitbag_api.h"

#include "analysis/beat_grid_fit.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <utility>

#include "analysis/beat_tracker.h"
#include "time_units.h"

namespace kitbag {

namespace {

constexpr size_t kMaxSlopePoints = 256;
constexpr size_t kMinBeatsForSlope = KB_CONSTANT_TEMPO_MIN_BEATS;
constexpr double kMinCountedPeriods = 0.75;

double Median(std::vector<double> values) {
  const auto mid =
      values.begin() + static_cast<std::ptrdiff_t>(values.size() / 2);
  std::nth_element(values.begin(), mid, values.end());
  return *mid;
}

std::vector<double> Intervals(const std::vector<double>& times) {
  std::vector<double> intervals;
  intervals.reserve(times.size() - 1);
  for (size_t k = 1; k < times.size(); ++k) {
    intervals.push_back(times[k] - times[k - 1]);
  }
  return intervals;
}

std::vector<double> SkipAwareNumbers(const std::vector<double>& times) {
  const std::vector<double> intervals = Intervals(times);
  const double typical = Median(intervals);
  std::vector<double> numbers(times.size(), 0.0);
  for (size_t k = 1; k < times.size(); ++k) {
    const double periods = std::round(intervals[k - 1] / typical);
    numbers[k] = numbers[k - 1] + std::max(1.0, periods);
  }
  return numbers;
}

size_t SlopeStride(size_t count) {
  return (count + kMaxSlopePoints - 1) / kMaxSlopePoints;
}

double MedianSlope(const BeatGridLine& line) {
  const size_t count = line.times.size();
  const size_t stride = SlopeStride(count);
  const size_t points = (count + stride - 1) / stride;
  std::vector<double> slopes;
  slopes.reserve(points * (points - 1) / 2);
  for (size_t i = 0; i < count; i += stride) {
    for (size_t j = i + stride; j < count; j += stride) {
      const double rise = line.times[j] - line.times[i];
      slopes.push_back(rise / (line.numbers[j] - line.numbers[i]));
    }
  }
  return Median(std::move(slopes));
}

double MedianIntercept(const BeatGridLine& line) {
  const size_t stride = SlopeStride(line.times.size());
  std::vector<double> intercepts;
  intercepts.reserve((line.times.size() + stride - 1) / stride);
  for (size_t i = 0; i < line.times.size(); i += stride) {
    intercepts.push_back(line.times[i] - line.period_sec * line.numbers[i]);
  }
  return Median(std::move(intercepts));
}

BeatGridLine TheilSen(BeatGridLine line) {
  if (line.times.size() < kMinBeatsForSlope) return {};
  line.period_sec = MedianSlope(line);
  line.intercept_sec = MedianIntercept(line);
  return line;
}

void CountBeats(const std::vector<double>& beats, BeatGridLine* line) {
  const double reference = Median(Intervals(beats));
  line->times.push_back(beats.front());
  line->numbers.push_back(0.0);
  for (size_t k = 1; k < beats.size(); ++k) {
    const double ratio = (beats[k] - line->times.back()) / reference;
    if (ratio < kMinCountedPeriods) continue;
    const double periods = std::max(1.0, std::floor(ratio + 0.5));
    line->numbers.push_back(line->numbers.back() + periods);
    line->times.push_back(beats[k]);
  }
}

}  // namespace

BeatGridLine FitBeatGrid(const std::vector<float>& beats) {
  if (beats.size() < kMinBeatsForSlope) return {};
  BeatGridLine line;
  line.times.assign(beats.begin(), beats.end());
  line.numbers = SkipAwareNumbers(line.times);
  return TheilSen(std::move(line));
}

BeatGridLine FitCountedBeats(const std::vector<float>& beats) {
  if (beats.size() < kMinBeatsForSlope) return {};
  BeatGridLine line;
  CountBeats(std::vector<double>(beats.begin(), beats.end()), &line);
  return TheilSen(std::move(line));
}

float BeatGridBpm(const std::vector<float>& beats) {
  const double period = FitBeatGrid(beats).period_sec;
  if (period <= 0.0) return 0.0f;
  return static_cast<float>(kSecondsPerMinute / period);
}

}  // namespace kitbag
