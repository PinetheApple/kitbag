#ifndef KITBAG_RT_FRAME_CLOCK_H
#define KITBAG_RT_FRAME_CLOCK_H

#include <atomic>
#include <cstdint>

namespace kitbag {

// What RtPublisher dates a retirement by. Read at the publish, since a call that
// primes can outlast the publisher's grace window after a value taken on entry.
class FrameClock {
 public:
  // Implicit: a fixed frame is what a caller with no running engine has.
  FrameClock(uint64_t fixed) : fixed_(fixed) {}

  static FrameClock Reading(const std::atomic<uint64_t>& frames) {
    FrameClock clock(0);
    clock.frames_ = &frames;
    return clock;
  }

  uint64_t Now() const {
    return frames_ != nullptr ? frames_->load(std::memory_order_relaxed)
                              : fixed_;
  }

 private:
  const std::atomic<uint64_t>* frames_ = nullptr;
  uint64_t fixed_;
};

}  // namespace kitbag

#endif  // KITBAG_RT_FRAME_CLOCK_H
