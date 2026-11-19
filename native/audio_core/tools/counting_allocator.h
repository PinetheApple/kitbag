#ifndef KITBAG_TOOLS_COUNTING_ALLOCATOR_H
#define KITBAG_TOOLS_COUNTING_ALLOCATOR_H

// Replaces global operator new for the whole executable so heap_probe.h reads
// the heap's high-water mark. Include it from exactly one translation unit.
#include <cstddef>
#include <cstdlib>
#include <new>

#include "heap_probe.h"

namespace kitbag_test {

// The size prefix keeps the returned pointer max_align_t aligned.
inline constexpr size_t kAllocHeader = alignof(std::max_align_t);

inline void* CountedAlloc(size_t size) {
  auto* block = static_cast<unsigned char*>(std::malloc(size + kAllocHeader));
  if (block == nullptr) throw std::bad_alloc();
  *reinterpret_cast<size_t*>(block) = size;
  const size_t live = g_live_bytes.fetch_add(size) + size;
  size_t peak = g_peak_bytes.load();
  while (live > peak && !g_peak_bytes.compare_exchange_weak(peak, live)) {
  }
  return block + kAllocHeader;
}

inline void CountedFree(void* ptr) {
  if (ptr == nullptr) return;
  auto* block = static_cast<unsigned char*>(ptr) - kAllocHeader;
  g_live_bytes.fetch_sub(*reinterpret_cast<size_t*>(block));
  std::free(block);
}

}  // namespace kitbag_test

void* operator new(size_t size) {
  return kitbag_test::CountedAlloc(size);
}
void* operator new[](size_t size) {
  return kitbag_test::CountedAlloc(size);
}
void operator delete(void* ptr) noexcept {
  kitbag_test::CountedFree(ptr);
}
void operator delete[](void* ptr) noexcept {
  kitbag_test::CountedFree(ptr);
}
void operator delete(void* ptr, size_t) noexcept {
  kitbag_test::CountedFree(ptr);
}
void operator delete[](void* ptr, size_t) noexcept {
  kitbag_test::CountedFree(ptr);
}

#endif  // KITBAG_TOOLS_COUNTING_ALLOCATOR_H
