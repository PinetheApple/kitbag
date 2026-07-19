// C ABI verification: exercises kitbag_api.h through the shared library, the
// way the app will. kb_metronome_set_grid's validation loop is the only thing
// between a malformed grid and std::lower_bound's ordering precondition being
// violated inside the audio callback, so it is checked here at the boundary
// that actually enforces it — not against the C++ class behind it.
#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

void ExpectRejected(
    kb_engine* engine,
    const double* times,
    int32_t count,
    const char* message
) {
  const kb_result result = kb_metronome_set_grid(engine, times, count, 0);
  if (result != KB_ERROR_INVALID_ARGUMENT) {
    std::fprintf(
        stderr,
        "FAIL: %s (got %d, wanted KB_ERROR_INVALID_ARGUMENT)\n",
        message,
        static_cast<int>(result)
    );
    ++g_failures;
  }
}

void TestSetGridValidation(kb_engine* engine) {
  const double ascending[] = {0.0, 0.5, 1.0, 1.5};
  Check(
      kb_metronome_set_grid(engine, ascending, 4, 0) == KB_OK,
      "set_grid: a strictly ascending finite grid is accepted"
  );

  ExpectRejected(engine, nullptr, 4, "set_grid: null beat_times_sec");
  ExpectRejected(engine, ascending, 0, "set_grid: empty grid");
  Check(
      kb_metronome_set_grid(nullptr, ascending, 4, 0) ==
          KB_ERROR_INVALID_ARGUMENT,
      "set_grid: null engine"
  );

  const double descending[] = {0.0, 0.5, 0.25, 1.0};
  ExpectRejected(engine, descending, 4, "set_grid: descending grid");

  // Equal neighbours are not ascending either: a zero interval would divide by
  // zero in the mirrors and fire two beats on one frame.
  const double repeated[] = {0.0, 0.5, 0.5, 1.0};
  ExpectRejected(engine, repeated, 4, "set_grid: repeated beat time");

  // NaN needs its own check: every comparison against it is false, so it slips
  // straight through an ascending test written as `<=`.
  const double nan_grid[] = {0.0, 0.5, std::nan(""), 1.5};
  ExpectRejected(engine, nan_grid, 4, "set_grid: NaN beat time");
  const double nan_first[] = {std::nan(""), 0.5, 1.0, 1.5};
  ExpectRejected(engine, nan_first, 4, "set_grid: NaN as the first beat");

  const double infinite[] = {0.0, 0.5, HUGE_VAL, 1.5};
  ExpectRejected(engine, infinite, 4, "set_grid: infinite beat time");

  // Above KB_MAX_GRID_BEATS the copy is unbounded work on the app thread.
  std::vector<double> too_many(KB_MAX_GRID_BEATS + 1);
  for (size_t i = 0; i < too_many.size(); ++i) {
    too_many[i] = 0.5 * static_cast<double>(i);
  }
  ExpectRejected(
      engine,
      too_many.data(),
      static_cast<int32_t>(too_many.size()),
      "set_grid: count above KB_MAX_GRID_BEATS"
  );

  kb_metronome_clear_grid(engine);
  kb_metronome_clear_grid(nullptr);  // must not crash
}

}  // namespace

int main() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK || engine == nullptr) {
    // Not a skip: without an engine none of the below is exercised, and a tool
    // that reports success having asserted nothing is how this repo got its
    // §2 audit.
    std::fprintf(stderr, "abi_verify: could not create an engine\n");
    return 1;
  }

  TestSetGridValidation(engine);

  kb_engine_destroy(engine);

  if (g_failures == 0) {
    std::printf("abi_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "abi_verify: %d failure(s)\n", g_failures);
  return 1;
}
