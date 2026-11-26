#ifndef KITBAG_RT_MONOTONIC_CLOCK_H
#define KITBAG_RT_MONOTONIC_CLOCK_H

#include <time.h>

#include <chrono>
#include <cmath>
#include <cstdint>
#include <ratio>

namespace kitbag {

inline constexpr int64_t kNsPerSecond = std::nano::den;

inline int64_t ClockNs(clockid_t clock) {
  timespec now{};
  clock_gettime(clock, &now);
  return (std::chrono::seconds(now.tv_sec) +
          std::chrono::nanoseconds(now.tv_nsec))
      .count();
}

// vDSO on arm64 Android: no syscall.
inline int64_t MonotonicNs() {
  return ClockNs(CLOCK_MONOTONIC);
}

inline int64_t BoottimeNs() {
#ifdef CLOCK_BOOTTIME
  return ClockNs(CLOCK_BOOTTIME);
#else
  return MonotonicNs();
#endif
}

// Bracketing the boottime read halves the error a preemption between the
// reads can add.
inline int64_t SuspendedNs() {
  const int64_t before = MonotonicNs();
  const int64_t boottime = BoottimeNs();
  const int64_t after = MonotonicNs();
  return boottime - (before + (after - before) / 2);
}

// Whole seconds apart, so a span of days cannot overflow the product.
inline int64_t NsToFrames(int64_t ns, uint32_t sample_rate) {
  const double rest_frames = static_cast<double>(ns % kNsPerSecond) *
                             sample_rate / static_cast<double>(kNsPerSecond);
  return (ns / kNsPerSecond) * sample_rate + std::llround(rest_frames);
}

}  // namespace kitbag

#endif  // KITBAG_RT_MONOTONIC_CLOCK_H
