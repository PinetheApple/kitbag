#include "kitbag_api.h"

#include "analysis/constant_tempo.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <limits>

#include "analysis/beat_grid_fit.h"
#include "analysis/meter.h"
#include "time_units.h"

namespace kitbag {

namespace {

constexpr int kMinBarBeats = 2;
constexpr int kMaxBarBeats = 16;
constexpr double kDownbeatReachPeriods = 0.25;

// Ties go to the value seen first, as Python's Counter.most_common does.
class Tally {
 public:
  void Add(int value, size_t order) {
    if (count_[value]++ == 0) first_[value] = order;
  }

  int Mode(int fallback) const {
    int best = fallback;
    int best_count = 0;
    size_t best_first = std::numeric_limits<size_t>::max();
    for (int value = 0; value <= kMaxBarBeats; ++value) {
      const bool wins = count_[value] > best_count ||
                        (count_[value] > 0 && count_[value] == best_count &&
                         first_[value] < best_first);
      if (!wins) continue;
      best = value;
      best_count = count_[value];
      best_first = first_[value];
    }
    return best;
  }

 private:
  std::array<int, kMaxBarBeats + 1> count_{};
  std::array<size_t, kMaxBarBeats + 1> first_{};
};

// As StemDeck's _downbeat_numbers.
bool NearestCounted(const BeatGridLine& line, double time, double* number) {
  const auto& times = line.times;
  auto at = std::lower_bound(times.begin(), times.end(), time);
  if (at == times.end() ||
      (at != times.begin() && time - *(at - 1) <= *at - time)) {
    --at;
  }
  *number = line.numbers[static_cast<size_t>(at - times.begin())];
  return std::fabs(*at - time) <= kDownbeatReachPeriods * line.period_sec;
}

std::vector<double> DownbeatNumbers(
    const BeatGridLine& line,
    const std::vector<float>& beats,
    const std::vector<int>& downbeats
) {
  std::vector<double> numbers;
  numbers.reserve(downbeats.size());
  for (const int index : downbeats) {
    double number = 0.0;
    if (NearestCounted(line, beats[index], &number)) numbers.push_back(number);
  }
  std::sort(numbers.begin(), numbers.end());
  numbers.erase(std::unique(numbers.begin(), numbers.end()), numbers.end());
  return numbers;
}

int BeatsPerBar(const std::vector<double>& down) {
  Tally spans;
  for (size_t i = 1; i < down.size(); ++i) {
    const double span = down[i] - down[i - 1];
    if (span >= kMinBarBeats && span <= kMaxBarBeats) {
      spans.Add(static_cast<int>(span), i);
    }
  }
  return spans.Mode(kCommonBeatsPerBar);
}

int BarPhase(const std::vector<double>& down, int beats_per_bar) {
  Tally phases;
  for (size_t i = 0; i < down.size(); ++i) {
    phases.Add(static_cast<int>(std::fmod(down[i], beats_per_bar)), i);
  }
  return phases.Mode(0);
}

double ForwardToZero(double anchor, double bar) {
  if (anchor >= 0.0) return anchor;
  const double moved = anchor + std::ceil(-anchor / bar) * bar;
  return moved < 0.0 ? moved + bar : moved;
}

}  // namespace

bool FitConstantTempo(
    const std::vector<float>& beats,
    const std::vector<int>& downbeats,
    ConstantTempo* out
) {
  const BeatGridLine line = FitCountedBeats(beats);
  const double bpm = kSecondsPerMinute / line.period_sec;
  if (!(bpm >= KB_CONSTANT_TEMPO_MIN_BPM && bpm <= KB_CONSTANT_TEMPO_MAX_BPM)) {
    return false;
  }
  const std::vector<double> down = DownbeatNumbers(line, beats, downbeats);
  const int beats_per_bar = BeatsPerBar(down);
  const double phase = BarPhase(down, beats_per_bar);
  const double anchor = line.intercept_sec + phase * line.period_sec;
  out->bpm = bpm;
  out->anchor_sec = ForwardToZero(anchor, beats_per_bar * line.period_sec);
  out->beats_per_bar = beats_per_bar;
  return true;
}

}  // namespace kitbag
