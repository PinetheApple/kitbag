// RtPublisher, the app→RT bulk-payload seam. Its failure mode is a
// use-after-free in the audio callback, so reclamation is pinned separately.
#include "../src/rt_publisher.h"
#include "metronome_test_util.h"

namespace metronome_test {
namespace {

// Generations advance and the payload survives.
void TestRtPublisher() {
  kitbag::RtPublisher<int> publisher;
  Check(publisher.Get() == nullptr, "publisher: empty until published");

  auto first = std::make_unique<int>(7);
  publisher.Publish(std::move(first), 0, true);
  const auto* a = publisher.Get();
  Check(a != nullptr && a->value == 7, "publisher: publishes the payload");
  Check(a->generation == 1, "publisher: first generation is 1");

  publisher.Publish(std::make_unique<int>(9), 0, true);
  const auto* b = publisher.Get();
  Check(b != nullptr && b->value == 9, "publisher: replaces the payload");
  Check(b->generation == 2, "publisher: generation advances on republish");

  publisher.Publish(nullptr, 0, true);
  Check(publisher.Get() == nullptr, "publisher: nullptr clears");

  publisher.ReclaimAll();
  Check(publisher.retired_size() == 0, "publisher: ReclaimAll empties retired");
}

// Retired payloads are held until the frame clock has moved a full grace
// window past the swap, and are then actually freed rather than accumulating.
void TestRtPublisherGraceWindow() {
  const uint64_t grace = kitbag::RtPublisher<int>::kReclaimGraceFrames;
  kitbag::RtPublisher<int> publisher;

  publisher.Publish(std::make_unique<int>(1), 0, true);
  Check(publisher.retired_size() == 0, "reclaim: nothing retired by the first");
  publisher.Publish(std::make_unique<int>(2), 0, true);
  Check(publisher.retired_size() == 1, "reclaim: the replaced payload retires");
  publisher.Publish(std::make_unique<int>(3), 1000, true);
  Check(publisher.retired_size() == 2, "reclaim: nothing freed inside grace");

  // Strictly greater-than: a reader one frame short of the window is safe.
  publisher.Collect(grace);
  Check(publisher.retired_size() == 2, "reclaim: held at the grace boundary");

  publisher.Collect(grace + 1);
  Check(publisher.retired_size() == 1, "reclaim: freed one frame past grace");

  publisher.Collect(60000 + grace);
  Check(publisher.retired_size() == 0, "reclaim: all freed once well past");
}

// With no reader — the engine never started, which is when a grid is usually
// set — reclamation cannot wait on a clock that is not moving.
void TestRtPublisherReclaimsWithNoReader() {
  kitbag::RtPublisher<int> stopped;
  for (int i = 0; i < 8; ++i) {
    stopped.Publish(std::make_unique<int>(i), 0, false);
  }
  Check(
      stopped.retired_size() == 0,
      "reclaim: publishing with no reader frees immediately"
  );
}

}  // namespace

void RunPublisherTests() {
  TestRtPublisher();
  TestRtPublisherGraceWindow();
  TestRtPublisherReclaimsWithNoReader();
}

}  // namespace metronome_test
