// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land where the contract says. Suite entry point only.
#include <cstdio>

#include "metronome_test_support.h"
#include "rt_test_support.h"

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 366;

void RunAllTests() {
  metronome_test::RunBasicTests();
  metronome_test::RunSignatureTests();
  metronome_test::RunStartAtTests();
  metronome_test::RunLatencyTests();
  metronome_test::RunGridTests();
  metronome_test::RunAnchorTests();
  metronome_test::RunPolyTests();
  metronome_test::RunSoundTests();
  metronome_test::RunCountInTests();
  metronome_test::RunLongCountInTests();
  metronome_test::RunRampTests();
  metronome_test::RunRampLiveTests();
  rt_test::RunPublisherTests();
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
