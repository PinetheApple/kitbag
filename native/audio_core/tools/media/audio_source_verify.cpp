// Offline AudioSource verification: drives the streaming contract through the
// in-memory adapter, with no file on disk. Suite entry point only.
#include <cstdio>

#include "media_test_support.h"
#include "rt_test_support.h"

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 104;

int main() {
  // Hosted here rather than given its own binary, matching how metronome_verify
  // hosts the RtPublisher suite: rt/ primitives carry no rig of their own.
  rt_test::RunBulkRingTests();
  media_test::RunStreamTests();
  media_test::RunEdgeTests();

  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "audio_source_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("audio_source_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "audio_source_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
