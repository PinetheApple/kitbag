#ifndef KITBAG_RT_SPSC_BULK_RING_H
#define KITBAG_RT_SPSC_BULK_RING_H

#include <atomic>
#include <cstddef>
#include <cstring>
#include <vector>

namespace kitbag {

// Bulk half of spsc_ring.h's discipline, not a second one: same single
// producer, single consumer, same acquire/release pair on two indices. It
// exists because PCM moves in spans — one atomic per sample would cost more
// than the copy it guards, and the capacity has to be chosen at run time from
// the stream's channel count.
//
// Producer = the read-ahead thread (Write/write_available). Consumer = the
// audio callback (Read/read_available). Both are allocation-free and
// wait-free; only Init allocates, on the app thread before either runs.
template <typename T>
class SpscBulkRing {
 public:
  // App thread. Rounds up to a power of two so the wrap is a mask, not a
  // modulo. Must complete before the producer or consumer starts.
  void Init(size_t capacity) {
    size_t rounded = 1;
    while (rounded < capacity) rounded <<= 1U;
    buffer_.assign(rounded, T{});
    mask_ = rounded - 1;
    head_.store(0, std::memory_order_relaxed);
    tail_.store(0, std::memory_order_relaxed);
  }

  // App thread, with both the producer and the consumer stopped. Discards
  // everything buffered; the only operation here that neither side owns.
  void Clear() {
    head_.store(0, std::memory_order_relaxed);
    tail_.store(0, std::memory_order_relaxed);
  }

  // Producer. Returns the number of elements accepted, which is less than
  // `count` when the ring is full.
  size_t Write(const T* src, size_t count) {
    const uint64_t head = head_.load(std::memory_order_relaxed);
    const uint64_t tail = tail_.load(std::memory_order_acquire);
    const size_t space = capacity() - static_cast<size_t>(head - tail);
    const size_t n = count < space ? count : space;
    CopyIntoRing(src, head, n);
    head_.store(head + n, std::memory_order_release);
    return n;
  }

  // Consumer (realtime). Returns the number of elements delivered, which is
  // less than `count` when the ring is starved or drained at end of stream.
  size_t Read(T* dst, size_t count) {
    const uint64_t tail = tail_.load(std::memory_order_relaxed);
    const uint64_t head = head_.load(std::memory_order_acquire);
    const size_t filled = static_cast<size_t>(head - tail);
    const size_t n = count < filled ? count : filled;
    CopyOutOfRing(dst, tail, n);
    tail_.store(tail + n, std::memory_order_release);
    return n;
  }

  size_t write_available() const {
    const uint64_t head = head_.load(std::memory_order_relaxed);
    const uint64_t tail = tail_.load(std::memory_order_acquire);
    return capacity() - static_cast<size_t>(head - tail);
  }

  size_t read_available() const {
    const uint64_t tail = tail_.load(std::memory_order_relaxed);
    const uint64_t head = head_.load(std::memory_order_acquire);
    return static_cast<size_t>(head - tail);
  }

  size_t capacity() const {
    return buffer_.size();
  }

 private:
  // Indices are monotonic 64-bit counters masked only at access, so head-tail
  // is the fill directly and no slot has to be sacrificed to tell full from
  // empty.
  size_t offset_of(uint64_t index) const {
    return static_cast<size_t>(index & mask_);
  }

  // Elements before the wrap. The trailing memcpy of the remainder is a no-op
  // when there is no wrap, which is why neither copy needs a branch.
  size_t span_before_wrap(uint64_t index, size_t n) const {
    const size_t to_end = capacity() - offset_of(index);
    return to_end < n ? to_end : n;
  }

  void CopyIntoRing(const T* src, uint64_t head, size_t n) {
    const size_t first = span_before_wrap(head, n);
    std::memcpy(buffer_.data() + offset_of(head), src, first * sizeof(T));
    std::memcpy(buffer_.data(), src + first, (n - first) * sizeof(T));
  }

  void CopyOutOfRing(T* dst, uint64_t tail, size_t n) const {
    const size_t first = span_before_wrap(tail, n);
    std::memcpy(dst, buffer_.data() + offset_of(tail), first * sizeof(T));
    std::memcpy(dst + first, buffer_.data(), (n - first) * sizeof(T));
  }

  std::vector<T> buffer_;
  size_t mask_ = 0;
  std::atomic<uint64_t> head_{0};  // producer writes, consumer reads
  std::atomic<uint64_t> tail_{0};  // consumer writes, producer reads
};

}  // namespace kitbag

#endif  // KITBAG_RT_SPSC_BULK_RING_H
