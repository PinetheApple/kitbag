#include <cstdio>

#include "soak_fixtures.h"

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 176;

int main() {
  soak_test::RunClassifyTests();
  soak_test::RunRobustnessTests();
  soak_test::RunTimingTests();
  soak_test::RunRecordingEndTests();
  soak_test::RunCliTests();
  soak_test::RunMetronomeTests();
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "click_soak_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf(
        "click_soak_verify: all %d checks passed\n",
        kitbag_test::g_checks
    );
    return 0;
  }
  std::fprintf(
      stderr,
      "click_soak_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
