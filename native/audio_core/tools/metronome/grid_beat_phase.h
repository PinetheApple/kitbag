#ifndef KITBAG_TOOLS_METRONOME_GRID_BEAT_PHASE_H
#define KITBAG_TOOLS_METRONOME_GRID_BEAT_PHASE_H

#include "metronome_test_support.h"

namespace metronome_test {

// Half a sample past each beat keeps every fire frame off a rounding boundary,
// so the model and the engine cannot round one beat to different frames.
inline constexpr double kBeatPhaseSec = 0.5 / kSampleRate;

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_GRID_BEAT_PHASE_H
