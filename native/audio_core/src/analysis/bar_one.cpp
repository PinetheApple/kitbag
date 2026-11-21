#include "analysis/bar_one.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>

#include "analysis/meter.h"

namespace kitbag {

namespace {

constexpr int kPositionsCompared = 3;
constexpr double kMinClearanceFraction = 1e-3;

struct TCritical {
  size_t degrees_of_freedom;
  double value;
};

// Student's t, one-sided 97.5%, for the largest tabulated df at or below the
// actual; 1.96 is its large-sample limit.
constexpr std::array<TCritical, 14> kTCritical = {{
    {1, 12.706},
    {2, 4.303},
    {3, 3.182},
    {4, 2.776},
    {5, 2.571},
    {6, 2.447},
    {7, 2.365},
    {8, 2.306},
    {9, 2.262},
    {10, 2.228},
    {20, 2.086},
    {30, 2.042},
    {60, 2.000},
    {120, 1.980},
}};
constexpr double kLargeSampleT = 1.960;

double TCriticalFor(size_t degrees_of_freedom) {
  if (degrees_of_freedom > kTCritical.back().degrees_of_freedom) {
    return kLargeSampleT;
  }
  double value = kTCritical.front().value;
  for (const TCritical& t : kTCritical) {
    if (t.degrees_of_freedom <= degrees_of_freedom) value = t.value;
  }
  return value;
}

struct PhaseMean {
  double mean = 0.0;
  double variance_of_mean = 0.0;
  size_t count = 0;
};

std::vector<PhaseMean>
MeasurePhases(const std::vector<double>& beat_sd, int timesig) {
  std::vector<PhaseMean> phases(timesig);
  for (size_t i = 0; i < beat_sd.size(); ++i) {
    PhaseMean& p = phases[PositionAfter(i, timesig)];
    p.mean += beat_sd[i];
    ++p.count;
  }
  for (PhaseMean& p : phases) {
    if (p.count > 0) p.mean /= static_cast<double>(p.count);
  }
  std::vector<double> sum_sq(timesig, 0.0);
  for (size_t i = 0; i < beat_sd.size(); ++i) {
    const int position = PositionAfter(i, timesig);
    const double d = beat_sd[i] - phases[position].mean;
    sum_sq[position] += d * d;
  }
  for (int position = 0; position < timesig; ++position) {
    PhaseMean& p = phases[position];
    if (p.count < 2) continue;
    const auto n = static_cast<double>(p.count);
    p.variance_of_mean = sum_sq[position] / ((n - 1.0) * n);
  }
  return phases;
}

int HighestExcept(
    const std::vector<PhaseMean>& phases,
    int skip_a,
    int skip_b
) {
  int best = -1;
  for (int p = 0; p < static_cast<int>(phases.size()); ++p) {
    if (p == skip_a || p == skip_b) continue;
    if (best < 0 || phases[p].mean > phases[best].mean) best = p;
  }
  return best;
}

int HighestExcept(const std::vector<PhaseMean>& phases, int skip) {
  return HighestExcept(phases, skip, skip);
}

bool ClearsRest(const PhaseMean& pair, const PhaseMean& rest) {
  const double clearance = pair.mean - rest.mean;
  if (clearance <= kMinClearanceFraction * pair.mean) return false;
  const double standard_error =
      std::sqrt(pair.variance_of_mean + rest.variance_of_mean);
  const size_t degrees_of_freedom = std::min(pair.count, rest.count) - 1;
  return clearance > TCriticalFor(degrees_of_freedom) * standard_error;
}

}  // namespace

int BarOnePhase(const std::vector<double>& beat_sd, int timesig, int qm_phase) {
  if (timesig < kPositionsCompared) return qm_phase;
  const std::vector<PhaseMean> phases = MeasurePhases(beat_sd, timesig);
  const int before = (qm_phase + timesig - 1) % timesig;
  if (HighestExcept(phases, qm_phase) != before) return qm_phase;
  const PhaseMean& rest = phases[HighestExcept(phases, qm_phase, before)];
  const PhaseMean& pair = phases[before];
  if (pair.count < 2 || rest.count < 2) return qm_phase;
  const double spread = phases[qm_phase].mean - pair.mean;
  if (spread >= pair.mean - rest.mean) return qm_phase;
  return ClearsRest(pair, rest) ? before : qm_phase;
}

}  // namespace kitbag
