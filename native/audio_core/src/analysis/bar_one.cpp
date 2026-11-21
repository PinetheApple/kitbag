#include "analysis/bar_one.h"

#include <cmath>
#include <cstddef>

#include "analysis/meter.h"

namespace kitbag {

namespace {

// Two standard errors: a pair that clears the rest by less is bar-to-bar noise.
constexpr double kEvidenceStandardErrors = 2.0;

struct PhaseMean {
  double mean = 0.0;
  double variance_of_mean = 0.0;
  size_t count = 0;
};

std::vector<PhaseMean>
MeasurePhases(const std::vector<double>& beat_sd, int timesig) {
  std::vector<PhaseMean> phases(timesig);
  for (size_t i = 0; i < beat_sd.size(); ++i) {
    PhaseMean& p = phases[(i + 1) % timesig];
    p.mean += beat_sd[i];
    ++p.count;
  }
  for (PhaseMean& p : phases) {
    if (p.count > 0) p.mean /= static_cast<double>(p.count);
  }
  for (size_t i = 0; i < beat_sd.size(); ++i) {
    PhaseMean& p = phases[(i + 1) % timesig];
    const double d = beat_sd[i] - p.mean;
    p.variance_of_mean += d * d;
  }
  for (PhaseMean& p : phases) {
    if (p.count < 2) continue;
    const auto n = static_cast<double>(p.count);
    p.variance_of_mean /= (n - 1.0) * n;
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

}  // namespace

int BarOnePhase(const std::vector<double>& beat_sd, int timesig, int qm_phase) {
  if (timesig < kTripleBeatsPerBar) return qm_phase;
  const std::vector<PhaseMean> phases = MeasurePhases(beat_sd, timesig);
  const int before = (qm_phase + timesig - 1) % timesig;
  const int second = HighestExcept(phases, qm_phase, qm_phase);
  if (second != before) return qm_phase;
  const PhaseMean& rest = phases[HighestExcept(phases, qm_phase, before)];
  const PhaseMean& pair = phases[before];
  if (pair.count < 2 || rest.count < 2) return qm_phase;
  const double clearance = pair.mean - rest.mean;
  const double spread = phases[qm_phase].mean - pair.mean;
  const double noise = std::sqrt(pair.variance_of_mean + rest.variance_of_mean);
  if (spread >= clearance) return qm_phase;
  return clearance > kEvidenceStandardErrors * noise ? before : qm_phase;
}

}  // namespace kitbag
