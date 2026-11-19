#include <cmath>
#include <cstdio>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/onset_envelope.h"
#include "analyze_test_support.h"
#include "beat_spacing.h"
#include "check.h"
#include "metronome/metronome_internal.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag::kOnsetHopSize;
using kitbag::metronome_detail::kSecondsPerMinute;
using kitbag_test::Check;

struct Hit {
  double fraction;
  float amp;
  bool every_other_cycle = false;
};

// A third of the cycle lies under the fastest tracked lag, so the cycle is the
// beat; the alternate mid-cycle accent raises a peak between the triplets.
constexpr double kTripleCycleHops = 57.4;
constexpr Hit kTripleHits[] = {
    {0.0, 0.67f},
    {1.0 / 3.0, 0.4f},
    {2.0 / 3.0, 0.4f},
    {1.0 / 2.0, 1.0f, true},
};
// Backbeat at half the cycle; a faint off-level hit near two thirds of it must
// not stop the fold.
constexpr double kDupleCycleHops = 68.3;
constexpr Hit kDupleHits[] = {
    {0.0, 1.0f},
    {1.0 / 2.0, 0.8f},
    {2.0 / 3.0, 0.2f},
};
constexpr int kCycles = 60;
constexpr int kBackbeatsPerCycle = 2;

double CycleBpm(double cycle_hops) {
  return kSecondsPerMinute * kSampleRate / (cycle_hops * kOnsetHopSize);
}

template <size_t N>
std::vector<float> MakeCycleTrack(double cycle_hops, const Hit (&hits)[N]) {
  const double cycle_frames = cycle_hops * kOnsetHopSize;
  const auto frames = static_cast<size_t>(std::lround(cycle_frames * kCycles));
  std::vector<float> pcm(frames * 2, 0.0f);
  for (int c = 0; c < kCycles; ++c) {
    for (const Hit& hit : hits) {
      if (hit.every_other_cycle && c % 2 != 0) continue;
      const auto start =
          static_cast<size_t>(std::lround((c + hit.fraction) * cycle_frames));
      for (size_t s = start; s < start + kClickWidth && s < frames; ++s) {
        pcm[s * 2] = kClickAmp * hit.amp;
        pcm[s * 2 + 1] = kClickAmp * hit.amp;
      }
    }
  }
  return pcm;
}

bool NearBpm(double got, double want) {
  return std::fabs(got - want) <= kBpmTolerance * want;
}

void CheckTripleCycleIsNotHalved() {
  const double bpm = CycleBpm(kTripleCycleHops);
  const BeatResult r =
      AnalyzePcm(MakeCycleTrack(kTripleCycleHops, kTripleHits));
  std::printf(
      "analyze_verify: triple-split cycle at %.2f BPM -> %.2f (%zu beats)\n",
      bpm,
      r.bpm,
      r.beat_times.size()
  );
  Check(
      NearBpm(r.bpm, bpm),
      "fold: a cycle split in three keeps its tempo, not half a cycle between "
      "its triplets"
  );
}

void CheckDupleCycleStillFolds() {
  const double bpm = kBackbeatsPerCycle * CycleBpm(kDupleCycleHops);
  const BeatResult r = AnalyzePcm(MakeCycleTrack(kDupleCycleHops, kDupleHits));
  std::printf(
      "analyze_verify: duple cycle with an off-level hit, backbeat at %.2f BPM "
      "-> %.2f (%zu beats)\n",
      bpm,
      r.bpm,
      r.beat_times.size()
  );
  Check(
      NearBpm(r.bpm, bpm),
      "fold: a duple cycle with a faint hit near two thirds still folds to "
      "its backbeat"
  );
}

}  // namespace

void RunFoldTests() {
  CheckTripleCycleIsNotHalved();
  CheckDupleCycleStillFolds();
}

}  // namespace analyze_test
