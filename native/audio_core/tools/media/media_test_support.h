#ifndef KITBAG_TOOLS_MEDIA_MEDIA_TEST_SUPPORT_H
#define KITBAG_TOOLS_MEDIA_MEDIA_TEST_SUPPORT_H

// Entry point for the media suite. check.h is re-exported deliberately: every
// test file here asserts through it and none should have to name it twice.
#include <chrono>
#include <cstdint>
#include <thread>

#include "check.h"

namespace media_test {

// Coprime with every block size the suite reads at, and far larger than the
// ring, so each run wraps many times and ends mid-ring rather than on a
// boundary where an off-by-one would cancel out.
constexpr uint64_t kTotalFrames = 4813;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kRingFrames = 300;
constexpr uint32_t kSampleRate = 44100;

// Buffers are prefilled with this before every read. Without a non-zero
// poison, "the undelivered tail is silence" would pass on a buffer the code
// never touched at all.
constexpr float kPoison = -1.0F;

// Every wait in this suite is bounded: a source that never fills must fail the
// check, not hang the tool.
constexpr auto kWaitTimeout = std::chrono::seconds(5);
constexpr auto kPollInterval = std::chrono::milliseconds(1);

template <typename Predicate>
bool WaitUntil(Predicate predicate) {
  const auto deadline = std::chrono::steady_clock::now() + kWaitTimeout;
  while (std::chrono::steady_clock::now() < deadline) {
    if (predicate()) return true;
    std::this_thread::sleep_for(kPollInterval);
  }
  return predicate();
}

void RunStreamTests();
void RunEdgeTests();

}  // namespace media_test

#endif  // KITBAG_TOOLS_MEDIA_MEDIA_TEST_SUPPORT_H
