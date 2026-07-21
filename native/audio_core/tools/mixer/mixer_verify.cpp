// Offline mixer verification: drives Mixer::Process without a device and
// asserts the transport and the mix. Suite entry point only.
#include <cstdio>

#include "mixer_test_support.h"

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 110;

int main() {
  mixer_test::RunTransportTests();
  mixer_test::RunMixTests();
  mixer_test::RunSourceTests();
  mixer_test::RunResampleTests();
  mixer_test::RunPublishTests();

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
