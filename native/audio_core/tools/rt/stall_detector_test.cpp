// StallDetector decides when the engine restarts a dead output stream (#143).
#include "rt/stall_detector.h"

#include "rt_test_support.h"

namespace rt_test {

using kitbag_test::Check;
namespace {

constexpr uint64_t kStallMs = 1500;
constexpr uint64_t kTickMs = 250;
constexpr uint64_t kBlockFrames = 480;

void TestMovingFramesNeverStall() {
  kitbag::StallDetector detector(kStallMs);
  detector.Reset(0, 0);
  bool stalled = false;
  for (uint64_t tick = 1; tick <= 40; ++tick) {
    stalled = stalled || detector.Observe(tick * kBlockFrames, tick * kTickMs);
  }
  Check(!stalled, "stall: a moving frame count is never a stall");
}

void TestStillFramesStallAfterThreshold() {
  kitbag::StallDetector detector(kStallMs);
  detector.Reset(kBlockFrames, 0);
  Check(
      !detector.Observe(kBlockFrames, kStallMs - 1),
      "stall: not reported before the threshold"
  );
  Check(
      detector.Observe(kBlockFrames, kStallMs),
      "stall: reported at the threshold"
  );
}

void TestStallReportsAgainAfterAnotherWait() {
  kitbag::StallDetector detector(kStallMs);
  detector.Reset(kBlockFrames, 0);
  Check(detector.Observe(kBlockFrames, kStallMs), "stall: first report");
  Check(
      !detector.Observe(kBlockFrames, kStallMs + kTickMs),
      "stall: no repeat straight after a report"
  );
  Check(
      detector.Observe(kBlockFrames, 2 * kStallMs),
      "stall: reported again when recovery did not help"
  );
}

void TestRecoveryClearsTheStall() {
  kitbag::StallDetector detector(kStallMs);
  detector.Reset(kBlockFrames, 0);
  Check(detector.Observe(kBlockFrames, kStallMs), "stall: stalled");
  Check(
      !detector.Observe(2 * kBlockFrames, kStallMs + kTickMs),
      "stall: frames moving again clears it"
  );
  Check(
      !detector.Observe(2 * kBlockFrames, 2 * kStallMs),
      "stall: the wait restarts from the recovery"
  );
}

}  // namespace

void RunStallDetectorTests() {
  TestMovingFramesNeverStall();
  TestStillFramesStallAfterThreshold();
  TestStallReportsAgainAfterAnotherWait();
  TestRecoveryClearsTheStall();
}

}  // namespace rt_test
