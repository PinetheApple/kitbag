// Offline mixer verification: drives Mixer::Process without a device and
// asserts the transport and the mix. Suite entry point only.
#include <cstdio>
#include <cstdlib>
#include <new>

#include "mixer_test_stretch_support.h"

namespace {

// Per thread, so the read-ahead threads' allocations never count against Process.
thread_local std::size_t t_allocations = 0;

void* CountedAlloc(std::size_t size) {
  ++t_allocations;
  void* block = std::malloc(size == 0 ? 1 : size);
  if (block == nullptr) throw std::bad_alloc();
  return block;
}

void* CountedAlignedAlloc(std::size_t size, std::align_val_t align) {
  ++t_allocations;
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

size_t mixer_test::ThreadAllocations() {
  return t_allocations;
}

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 231;

namespace {

int Report() {
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "mixer_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("mixer_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "mixer_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}

}  // namespace

int main() {
  mixer_test::RunTransportTests();
  mixer_test::RunMixTests();
  mixer_test::RunSourceTests();
  mixer_test::RunResampleTests();
  mixer_test::RunPublishTests();
  mixer_test::RunLoopTests();
  mixer_test::RunRelayoutTests();
  mixer_test::RunStretchTests();
  mixer_test::RunKeyBusTests();
  mixer_test::RunConfigTests();
  mixer_test::CleanupTempFiles();
  return Report();
}
