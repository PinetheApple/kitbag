// Offline mixdown export (SPEC.md §7.7) against the live render, plus its
// lifecycle and memory bounds.
#include <cstdio>

#include "mixdown_test_support.h"

namespace {

constexpr int kExpectedChecks = 90;

}  // namespace

int main() {
  using namespace mixdown_test;
  RunExactTests();
  RunStretchTests();
  RunLifecycleTests();
  RunMemoryTests();
  RemoveTempFiles();
  Check(g_checks + 1 == kExpectedChecks, "every test ran");
  if (g_failures > 0) {
    std::fprintf(
        stderr,
        "mixdown_verify: %d of %d checks failed\n",
        g_failures,
        g_checks
    );
    return 1;
  }
  std::printf("mixdown_verify: all %d checks passed\n", g_checks);
  return 0;
}
