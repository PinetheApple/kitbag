#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H

#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {

constexpr int64_t kRigStart = 12345;
constexpr auto kSecondsPerMinuteInt =
    static_cast<int64_t>(kitbag::metronome_detail::kSecondsPerMinute);

struct RigCase {
  int bpm;
  int subdivision;
};

struct RigTick {
  int64_t frame;
  int slot;
};

// Integer arithmetic, independent of the engine's doubles: tick k sounds on the
// first frame f with (f - start) * bpm * subdivision >= k * 60 * rate.
inline RigTick ModelTick(int64_t start, const RigCase& rig, int64_t tick) {
  const int64_t numerator = tick * kSecondsPerMinuteInt * kSampleRate;
  const int64_t denominator = int64_t{rig.bpm} * rig.subdivision;
  return {
      start + (numerator + denominator - 1) / denominator,
      static_cast<int>(tick % rig.subdivision),
  };
}

inline std::string RigLabel(const char* what, const RigCase& rig) {
  return std::string("rig click: ") + what + " at " + std::to_string(rig.bpm) +
         " BPM / " + std::to_string(rig.subdivision);
}

void RunRigClickScheduleTests();
void RunRigClickSoundTests();
void RunRigClickIsolationTests();

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_RIG_MODEL_H
