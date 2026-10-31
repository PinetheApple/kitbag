#ifndef KITBAG_RT_CLOCK_PAIR_MIRROR_H
#define KITBAG_RT_CLOCK_PAIR_MIRROR_H

#include <atomic>
#include <cstdint>

namespace kitbag {

struct ClockPair {
  int64_t frame;
  int64_t monotonic_ns;
};

// Seqlock over two values. One writer at a time: the callback, or a control
// thread once the device is stopped. Readers never block it.
class ClockPairMirror {
 public:
  void Publish(int64_t frame, int64_t monotonic_ns) {
    Write(frame, monotonic_ns, true);
  }

  void Clear() {
    Write(0, 0, false);
  }

  bool Read(ClockPair* out) const {
    for (int attempt = 0; attempt < kReadAttempts; ++attempt) {
      const uint32_t before = sequence_.load(std::memory_order_acquire);
      const ClockPair pair{
          frame_.load(std::memory_order_relaxed),
          monotonic_ns_.load(std::memory_order_relaxed),
      };
      const bool valid = valid_.load(std::memory_order_relaxed);
      std::atomic_thread_fence(std::memory_order_acquire);
      if ((before & 1U) == 0 &&
          before == sequence_.load(std::memory_order_relaxed)) {
        if (valid) *out = pair;
        return valid;
      }
    }
    return false;
  }

 private:
  static constexpr int kReadAttempts = 64;

  void Write(int64_t frame, int64_t monotonic_ns, bool valid) {
    const uint32_t sequence = sequence_.load(std::memory_order_relaxed);
    sequence_.store(sequence + 1, std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_release);
    frame_.store(frame, std::memory_order_relaxed);
    monotonic_ns_.store(monotonic_ns, std::memory_order_relaxed);
    valid_.store(valid, std::memory_order_relaxed);
    sequence_.store(sequence + 2, std::memory_order_release);
  }

  std::atomic<uint32_t> sequence_{0};
  std::atomic<int64_t> frame_{0};
  std::atomic<int64_t> monotonic_ns_{0};
  std::atomic<bool> valid_{false};
};

}  // namespace kitbag

#endif  // KITBAG_RT_CLOCK_PAIR_MIRROR_H
