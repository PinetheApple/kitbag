// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land where the contract says. Suite entry point only.
#include <cstdio>

#include "metronome_test_util.h"

int main() {
  metronome_test::RunBasicTests();
  metronome_test::RunStartAtTests();
  metronome_test::RunLatencyTests();
  metronome_test::RunGridTests();
  metronome_test::RunPublisherTests();

  if (metronome_test::g_failures == 0) {
    std::printf("metronome_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "metronome_verify: %d failure(s)\n",
      metronome_test::g_failures
  );
  return 1;
}
