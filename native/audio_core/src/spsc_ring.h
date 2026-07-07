#ifndef KITBAG_SPSC_RING_H
#define KITBAG_SPSC_RING_H

#include <atomic>
#include <cstddef>

namespace kitbag {

// Single-producer single-consumer lock-free ring. Producer = app thread,
// consumer = realtime audio callback. Capacity must be a power of two.
template <typename T, size_t Capacity>
class SpscRing {
  static_assert((Capacity & (Capacity - 1)) == 0, "capacity must be 2^n");

 public:
  bool Push(const T& item) {
    const size_t head = head_.load(std::memory_order_relaxed);
    const size_t next = (head + 1) & kMask;
    if (next == tail_.load(std::memory_order_acquire)) {
      return false;  // full
    }
    slots_[head] = item;
    head_.store(next, std::memory_order_release);
    return true;
  }

  bool Pop(T* out) {
    const size_t tail = tail_.load(std::memory_order_relaxed);
    if (tail == head_.load(std::memory_order_acquire)) {
      return false;  // empty
    }
    *out = slots_[tail];
    tail_.store((tail + 1) & kMask, std::memory_order_release);
    return true;
  }

 private:
  static constexpr size_t kMask = Capacity - 1;
  T slots_[Capacity];
  std::atomic<size_t> head_{0};
  std::atomic<size_t> tail_{0};
};

}  // namespace kitbag

#endif  // KITBAG_SPSC_RING_H
