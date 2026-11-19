#ifndef KITBAG_TOOLS_ZERO_CLOCK_H
#define KITBAG_TOOLS_ZERO_CLOCK_H

#include <cstdint>

#include "rt/frame_clock.h"

namespace kitbag_test {

inline constexpr kitbag::FrameClock kZeroClock{0};
// The engine frame for a harness that schedules no start.
inline constexpr uint64_t kUnclockedFrame = 0;

}  // namespace kitbag_test

#endif  // KITBAG_TOOLS_ZERO_CLOCK_H
