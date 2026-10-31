#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H

#include <cstdio>
#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_support.h"

namespace metronome_test {

constexpr int64_t kRigStart = 12345;
constexpr auto kSecondsPerMinuteInt =
    static_cast<int64_t>(kitbag::metronome_detail::kSecondsPerMinute);

struct RigCase {
  int64_t bpm_numerator;
  int subdivision;
  int64_t bpm_denominator = 1;

  constexpr double bpm() const {
    return static_cast<double>(bpm_numerator) /
           static_cast<double>(bpm_denominator);
  }
};

struct RigTick {
  int64_t frame;
  int slot;
};

// Integer arithmetic, independent of the engine's doubles: tick k sounds on the
// first frame f with (f - start) * bpm * subdivision >= k * 60 * rate.
inline RigTick ModelTick(int64_t start, const RigCase& rig, int64_t tick) {
  const int64_t numerator =
      tick * kSecondsPerMinuteInt * kSampleRate * rig.bpm_denominator;
  const int64_t denominator = rig.bpm_numerator * rig.subdivision;
  return {
      start + (numerator + denominator - 1) / denominator,
      static_cast<int>(tick % rig.subdivision),
  };
}

inline std::string RigLabel(const char* what, const RigCase& rig) {
  char tempo[32];
  std::snprintf(tempo, sizeof tempo, "%g", rig.bpm());
  return std::string("rig click: ") + what + " at " + tempo + " BPM / " +
         std::to_string(rig.subdivision);
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H
