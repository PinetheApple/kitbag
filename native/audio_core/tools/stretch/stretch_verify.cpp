#include <cstdio>
#include <cstdlib>
#include <new>

#include "stretch_test_support.h"

namespace {

std::size_t g_allocations = 0;

void* CountedAlloc(std::size_t size) {
  ++g_allocations;
  void* block = std::malloc(size == 0 ? 1 : size);
  if (block == nullptr) throw std::bad_alloc();
  return block;
}

void* CountedAlignedAlloc(std::size_t size, std::align_val_t align) {
  ++g_allocations;
  const auto alignment = static_cast<std::size_t>(align);
  const std::size_t rounded = (size + alignment - 1) / alignment * alignment;
  void* block =
      std::aligned_alloc(alignment, rounded == 0 ? alignment : rounded);
  if (block == nullptr) throw std::bad_alloc();
  return block;
}

}  // namespace

void* operator new(std::size_t size) {
  return CountedAlloc(size);
}
void* operator new[](std::size_t size) {
  return CountedAlloc(size);
}
void* operator new(std::size_t size, std::align_val_t align) {
  return CountedAlignedAlloc(size, align);
}
void* operator new[](std::size_t size, std::align_val_t align) {
  return CountedAlignedAlloc(size, align);
}
void operator delete(void* ptr) noexcept {
  std::free(ptr);
}
void operator delete[](void* ptr) noexcept {
  std::free(ptr);
}
void operator delete(void* ptr, std::size_t) noexcept {
  std::free(ptr);
}
void operator delete[](void* ptr, std::size_t) noexcept {
  std::free(ptr);
}
void operator delete(void* ptr, std::align_val_t) noexcept {
  std::free(ptr);
}
void operator delete[](void* ptr, std::align_val_t) noexcept {
  std::free(ptr);
}
void operator delete(void* ptr, std::size_t, std::align_val_t) noexcept {
  std::free(ptr);
}
void operator delete[](void* ptr, std::size_t, std::align_val_t) noexcept {
  std::free(ptr);
}

namespace stretch_test {

std::size_t AllocationCount() {
  return g_allocations;
}

}  // namespace stretch_test

constexpr int kExpectedChecks = 28;

int main() {
  stretch_test::RunAllocationTests();
  stretch_test::RunRateTests();
  stretch_test::RunPitchTests();
  stretch_test::RunLatencyTests();

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "stretch_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("stretch_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "stretch_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
