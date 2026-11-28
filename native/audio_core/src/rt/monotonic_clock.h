#ifndef KITBAG_RT_MONOTONIC_CLOCK_H
#define KITBAG_RT_MONOTONIC_CLOCK_H

#include <time.h>

#include <chrono>
#include <cmath>
#include <cstdint>
#include <limits>
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

// A bracket this tight errs under a quarter frame at 48 kHz.
inline constexpr int64_t kSuspendedBracketNs = 10'000;
inline constexpr int kSuspendedBracketAttempts = 16;

// A preemption between the reads errs by half the bracket, so wide ones retry.
template <typename Monotonic, typename Boottime>
int64_t SuspendedNsFrom(Monotonic monotonic, Boottime boottime) {
  int64_t narrowest = std::numeric_limits<int64_t>::max();
  int64_t offset = 0;
  for (int attempt = 0; attempt < kSuspendedBracketAttempts; ++attempt) {
    const int64_t before = monotonic();
    const int64_t boot = boottime();
    const int64_t span = monotonic() - before;
    if (span < narrowest) {
      narrowest = span;
      offset = boot - (before + span / 2);
    }
    if (span <= kSuspendedBracketNs) break;
  }
  return offset;
}

inline int64_t SuspendedNs() {
  return SuspendedNsFrom(
      [] { return MonotonicNs(); },
      [] { return BoottimeNs(); }
  );
}

// Whole seconds apart, so a span of days cannot overflow the product.
inline int64_t NsToFrames(int64_t ns, uint32_t sample_rate) {
  const double rest_frames = static_cast<double>(ns % kNsPerSecond) *
                             sample_rate / static_cast<double>(kNsPerSecond);
  return (ns / kNsPerSecond) * sample_rate + std::llround(rest_frames);
}

}  // namespace kitbag

#endif  // KITBAG_RT_MONOTONIC_CLOCK_H
