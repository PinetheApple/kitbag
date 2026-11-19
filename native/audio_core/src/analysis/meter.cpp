#include "analysis/meter.h"

#include <algorithm>
#include <cstddef>

namespace kitbag {

namespace {

constexpr double kWaltzMargin = 0.5;
constexpr size_t kMinWaltzBars = 4;

double Mean(const std::vector<double>& values) {
  double sum = 0.0;
  for (const double v : values) sum += v;
  return sum / static_cast<double>(values.size());
}

double PhaseContrast(const std::vector<double>& sd, int bar, int phase) {
  double on = 0.0;
  double off = 0.0;
  size_t on_count = 0;
  for (size_t i = 0; i < sd.size(); ++i) {
    if (static_cast<int>((i + 1) % bar) == phase) {
      on += sd[i];
      ++on_count;
    } else {
      off += sd[i];
    }
  }
  const size_t off_count = sd.size() - on_count;
  if (on_count == 0 || off_count == 0) return 0.0;
  return on / on_count - off / off_count;
}

}  // namespace

double BarContrast(const std::vector<double>& beat_sd, int beats_per_bar) {
  if (beat_sd.empty() || beats_per_bar < 2) return 0.0;
  const double mean = Mean(beat_sd);
  if (mean <= 0.0) return 0.0;
  double best = 0.0;
  for (int phase = 0; phase < beats_per_bar; ++phase) {
    best = std::max(best, PhaseContrast(beat_sd, beats_per_bar, phase));
  }
  return best / mean;
}

// Ties and short songs stay 4/4: a wrong 3/4 misplaces every bar after the
// first, so 3/4 must win by a clear margin.
int DetectBeatsPerBar(const std::vector<double>& beat_sd) {
  if (beat_sd.size() < kMinWaltzBars * kWaltzBeatsPerBar) {
    return kCommonBeatsPerBar;
  }
  const double waltz = BarContrast(beat_sd, kWaltzBeatsPerBar);
  const double common = BarContrast(beat_sd, kCommonBeatsPerBar);
  return waltz > common + kWaltzMargin ? kWaltzBeatsPerBar : kCommonBeatsPerBar;
}

}  // namespace kitbag
