#include "analysis/meter.h"

#include <algorithm>
#include <cstddef>

namespace kitbag {

namespace {

// A difference of mean-normalised contrasts, whose ceilings differ by meter.
// Real 4/4 stems led toward 3 by at most +0.167; synthetic 3/4 leads by ~2.9.
constexpr double kTripleMargin = 0.5;
constexpr size_t kMinDetectBars = 4;

double Mean(const std::vector<double>& values) {
  double sum = 0.0;
  for (const double v : values) sum += v;
  return sum / static_cast<double>(values.size());
}

double PhaseContrast(
    const std::vector<double>& beat_sd,
    int beats_per_bar,
    int phase
) {
  double on = 0.0;
  double off = 0.0;
  size_t on_count = 0;
  for (size_t i = 0; i < beat_sd.size(); ++i) {
    if (static_cast<int>((i + 1) % beats_per_bar) == phase) {
      on += beat_sd[i];
      ++on_count;
    } else {
      off += beat_sd[i];
    }
  }
  const size_t off_count = beat_sd.size() - on_count;
  if (on_count == 0 || off_count == 0) return 0.0;
  return on / on_count - off / off_count;
}

double BarContrast(const std::vector<double>& beat_sd, int beats_per_bar) {
  const double mean = Mean(beat_sd);
  if (mean <= 0.0) return 0.0;
  double best = 0.0;
  for (int phase = 0; phase < beats_per_bar; ++phase) {
    best = std::max(best, PhaseContrast(beat_sd, beats_per_bar, phase));
  }
  return best / mean;
}

}  // namespace

// A wrong 3 misplaces every bar, so ties and short songs stay 4.
int DetectBeatsPerBar(const std::vector<double>& beat_sd) {
  if (beat_sd.size() < kMinDetectBars * kTripleBeatsPerBar) {
    return kCommonBeatsPerBar;
  }
  const double triple = BarContrast(beat_sd, kTripleBeatsPerBar);
  const double common = BarContrast(beat_sd, kCommonBeatsPerBar);
  return triple > common + kTripleMargin ? kTripleBeatsPerBar
                                         : kCommonBeatsPerBar;
}

}  // namespace kitbag
