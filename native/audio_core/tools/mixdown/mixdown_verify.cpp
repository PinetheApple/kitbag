#include <cstdio>

#include "mixdown_test_support.h"

namespace {

constexpr int kExpectedChecks = 110;

}  // namespace

int main() {
  using namespace mixdown_test;
  RunExactTests();
  RunStretchTests();
  RunLifecycleTests();
  RunFailureTests();
  RunMemoryTests();
  RemoveTempFiles();
  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "mixdown_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures != 0) {
    std::fprintf(stderr, "mixdown_verify: %d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("mixdown_verify: all %d checks passed\n", g_checks);
  return 0;
}
