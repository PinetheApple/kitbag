// RtPublisher, the app→RT bulk-payload seam. Its failure mode is a
// use-after-free in the audio callback, so reclamation is pinned separately.
#include <atomic>
#include <memory>

#include "rt/frame_clock.h"
#include "rt/rt_publisher.h"
#include "rt_test_support.h"

namespace rt_test {

using kitbag::FrameClock;
using kitbag_test::Check;
namespace {

constexpr uint64_t kGrace = kitbag::RtPublisher<int>::kReclaimGraceFrames;
constexpr uint64_t kPreemptedFrames = 3 * kGrace + 517;
constexpr uint64_t kPinnedFrame = 12345;
constexpr int kPinnedPublishes = 64;

// Advances the clock while Publish builds its node, standing in for an app
// thread preempted between entering Publish and the swap.
struct SlowToMove {
  std::atomic<uint64_t>* frames = nullptr;

  explicit SlowToMove(std::atomic<uint64_t>* clock) : frames(clock) {}
  SlowToMove(SlowToMove&& other) noexcept : frames(other.frames) {
    frames->fetch_add(kPreemptedFrames);
  }
  SlowToMove(const SlowToMove&) = delete;
  SlowToMove& operator=(const SlowToMove&) = delete;
  SlowToMove& operator=(SlowToMove&&) = delete;
  ~SlowToMove() = default;
};

void TestRtPublisher() {
  kitbag::RtPublisher<int> publisher;
  Check(publisher.Get() == nullptr, "publisher: empty until published");

  publisher.Publish(std::make_unique<int>(7), FrameClock(0), true);
  const auto* a = publisher.Get();
  Check(a != nullptr && a->value == 7, "publisher: publishes the payload");
  Check(a->generation == 1, "publisher: first generation is 1");

  publisher.Publish(std::make_unique<int>(9), FrameClock(0), true);
  const auto* b = publisher.Get();
  Check(b != nullptr && b->value == 9, "publisher: replaces the payload");
  Check(b->generation == 2, "publisher: generation advances on republish");

  publisher.Publish(nullptr, FrameClock(0), true);
  Check(publisher.Get() == nullptr, "publisher: nullptr clears");

  publisher.ReclaimAll();
  Check(publisher.retired_size() == 0, "publisher: ReclaimAll empties retired");
}

void TestRtPublisherGraceWindow() {
  kitbag::RtPublisher<int> publisher;

  publisher.Publish(std::make_unique<int>(1), FrameClock(0), true);
  Check(publisher.retired_size() == 0, "reclaim: nothing retired by the first");
  publisher.Publish(std::make_unique<int>(2), FrameClock(0), true);
  Check(publisher.retired_size() == 1, "reclaim: the replaced payload retires");
  publisher.Publish(std::make_unique<int>(3), FrameClock(1000), true);
  Check(publisher.retired_size() == 2, "reclaim: nothing freed inside grace");

  publisher.Collect(kGrace);
  Check(publisher.retired_size() == 2, "reclaim: held at the grace boundary");

  publisher.Collect(kGrace + 1);
  Check(publisher.retired_size() == 1, "reclaim: freed one frame past grace");

  publisher.Collect(60000 + kGrace);
  Check(publisher.retired_size() == 0, "reclaim: all freed once well past");
}

void TestRtPublisherReclaimsWithNoReader() {
  kitbag::RtPublisher<int> stopped;
  for (int i = 0; i < 8; ++i) {
    stopped.Publish(std::make_unique<int>(i), FrameClock(0), false);
  }
  Check(
      stopped.retired_size() == 0,
      "reclaim: publishing with no reader frees immediately"
  );
}

void TestRetireDatedAtTheSwap() {
  std::atomic<uint64_t> frames{0};
  const FrameClock clock = FrameClock::Reading(frames);
  kitbag::RtPublisher<SlowToMove> publisher;
  publisher.Publish(std::make_unique<SlowToMove>(&frames), clock, true);
  publisher.Publish(std::make_unique<SlowToMove>(&frames), clock, true);
  const uint64_t swapped_at = frames.load();
  Check(
      swapped_at == 2 * kPreemptedFrames,
      "dating: the payload moves advanced the clock before each swap"
  );
  publisher.Collect(swapped_at + kGrace);
  Check(
      publisher.retired_size() == 1,
      "dating: a payload is held a full grace past the swap, not past the call"
  );
  publisher.Collect(swapped_at + kGrace + 1);
  Check(publisher.retired_size() == 0, "dating: and freed one frame past that");
}

void TestPinnedClockHoldsThenDrains() {
  std::atomic<uint64_t> frames{kPinnedFrame};
  const FrameClock clock = FrameClock::Reading(frames);
  kitbag::RtPublisher<int> publisher;
  for (int i = 0; i < kPinnedPublishes; ++i) {
    publisher.Publish(std::make_unique<int>(i), clock, true);
  }
  Check(
      publisher.retired_size() == kPinnedPublishes - 1,
      "pinned: a clock that does not move frees nothing"
  );
  frames.store(kPinnedFrame + kGrace);
  publisher.Publish(std::make_unique<int>(kPinnedPublishes), clock, true);
  Check(
      publisher.retired_size() == kPinnedPublishes,
      "pinned: still held with the clock a grace past the pin"
  );
  frames.store(kPinnedFrame + kGrace + 1);
  publisher.Publish(nullptr, clock, true);
  Check(
      publisher.retired_size() == 2,
      "pinned: everything retired while pinned drains one frame past grace"
  );
}

}  // namespace

void RunPublisherTests() {
  TestRtPublisher();
  TestRtPublisherGraceWindow();
  TestRtPublisherReclaimsWithNoReader();
  TestRetireDatedAtTheSwap();
  TestPinnedClockHoldsThenDrains();
}

}  // namespace rt_test
