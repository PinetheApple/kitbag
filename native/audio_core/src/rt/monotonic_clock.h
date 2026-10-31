#ifndef KITBAG_RT_MONOTONIC_CLOCK_H
#define KITBAG_RT_MONOTONIC_CLOCK_H

#include <time.h>

#include <chrono>
#include <cstdint>

namespace kitbag {

// vDSO on arm64 Android: no syscall.
inline int64_t MonotonicNs() {
  timespec now{};
  clock_gettime(CLOCK_MONOTONIC, &now);
  return (std::chrono::seconds(now.tv_sec) +
          std::chrono::nanoseconds(now.tv_nsec))
      .count();
}

}  // namespace kitbag

#endif  // KITBAG_RT_MONOTONIC_CLOCK_H
