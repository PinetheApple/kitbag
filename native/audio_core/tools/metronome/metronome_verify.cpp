// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land where the contract says. Suite entry point only.
#include <cstdio>

#include "counting_allocator.h"
#include "metronome_test_support.h"
#include "rt_test_support.h"

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 826;

void RunGridSuites() {
  metronome_test::RunGridTests();
  metronome_test::RunGridBarTests();
  metronome_test::RunGridGroupingTests();
  metronome_test::RunAnchorTests();
  metronome_test::RunFollowTests();
  metronome_test::RunFollowRateTests();
  metronome_test::RunGridOffsetChangeTests();
}

void RunMetronomeTests() {
  metronome_test::RunBasicTests();
  metronome_test::RunSignatureTests();
  metronome_test::RunStartAtTests();
  metronome_test::RunLatencyTests();
  metronome_test::RunLatencyFreeRunTests();
  RunGridSuites();
  metronome_test::RunPolyTests();
  metronome_test::RunPolyRatioTests();
  metronome_test::RunPolyRatioLiveTests();
  metronome_test::RunPolyTransportTests();
  metronome_test::RunPolyPhaseTests();
  metronome_test::RunSoundTests();
  metronome_test::RunCustomSoundTests();
  metronome_test::RunCustomSoundCutTests();
  metronome_test::RunTickTests();
  metronome_test::RunSubdivisionAccentTests();
  metronome_test::RunRigClickScheduleTests();
  metronome_test::RunRigClickSoundTests();
  metronome_test::RunRigClickIsolationTests();
  metronome_test::RunCountInTests();
  metronome_test::RunLongCountInTests();
  metronome_test::RunCountInAtTests();
  metronome_test::RunRampTests();
  metronome_test::RunRampLiveTests();
  metronome_test::RunRampSubdivisionTests();
  metronome_test::RunTrainerStatusTests();
  metronome_test::RunRampStatusTests();
  metronome_test::RunBarPhaseTests();
}

namespace metronome_test {

namespace {
size_t g_heap_baseline = 0;
}  // namespace

void ResetHeapPeak() {
  g_heap_baseline = kitbag_test::g_live_bytes.load();
  kitbag_test::g_peak_bytes.store(g_heap_baseline);
}

size_t HeapPeakGrowth() {
  return kitbag_test::g_peak_bytes.load() - g_heap_baseline;
}

size_t LiveHeapBytes() {
  return kitbag_test::g_live_bytes.load();
}

}  // namespace metronome_test

void RunAllTests() {
  RunMetronomeTests();
  rt_test::RunPublisherTests();
  rt_test::RunStallDetectorTests();
}

int main() {
  RunAllTests();

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "metronome_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("metronome_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "metronome_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
