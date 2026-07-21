// C ABI verification: exercises kitbag_api.h through the shared library, the
// way the app will. kb_metronome_set_grid's validation loop is the only thing
// between a malformed grid and std::lower_bound's ordering precondition being
// violated inside the audio callback, so it is checked here at the boundary
// that actually enforces it — not against the C++ class behind it.
#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "wav_fixture.h"

namespace {

int g_failures = 0;
// Counted so a deleted TestX() call cannot pass silently: the total is a
// tripwire on the suite's own shape, not a derived expectation.
int g_checks = 0;
// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 25;

void Check(bool condition, const char* message) {
  ++g_checks;
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
  ++g_checks;
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

void TestSetGridAcceptsAndNullChecks(kb_engine* engine) {
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
}

void TestSetGridRejectsNonAscending(kb_engine* engine) {
  const double descending[] = {0.0, 0.5, 0.25, 1.0};
  ExpectRejected(engine, descending, 4, "set_grid: descending grid");

  // Equal neighbours are not ascending either: a zero interval would divide by
  // zero in the mirrors and fire two beats on one frame.
  const double repeated[] = {0.0, 0.5, 0.5, 1.0};
  ExpectRejected(engine, repeated, 4, "set_grid: repeated beat time");
}

void TestSetGridRejectsNonFinite(kb_engine* engine) {
  // NaN needs its own check: every comparison against it is false, so it slips
  // straight through an ascending test written as `<=`.
  const double nan_grid[] = {0.0, 0.5, std::nan(""), 1.5};
  ExpectRejected(engine, nan_grid, 4, "set_grid: NaN beat time");
  const double nan_first[] = {std::nan(""), 0.5, 1.0, 1.5};
  ExpectRejected(engine, nan_first, 4, "set_grid: NaN as the first beat");

  const double infinite[] = {0.0, 0.5, HUGE_VAL, 1.5};
  ExpectRejected(engine, infinite, 4, "set_grid: infinite beat time");
}

void TestSetGridRejectsOversize(kb_engine* engine) {
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
}

void TestClearGrid(kb_engine* engine) {
  const double ascending[] = {0.0, 0.5, 1.0, 1.5};
  Check(
      kb_metronome_set_grid(engine, ascending, 4, 0) == KB_OK,
      "clear_grid: a grid can be set before clearing"
  );
  kb_metronome_clear_grid(engine);
  kb_metronome_clear_grid(nullptr);  // a null engine is a no-op, not a crash
  Check(
      kb_metronome_set_grid(engine, ascending, 4, 0) == KB_OK,
      "clear_grid: the engine still accepts a grid after clearing"
  );
}

// Transport is now callback-applied through the command ring (SPEC.md §2.2): the
// getters reflect state the audio callback has drained. A headless ABI test has
// no running device to drain them, so the semantics — seek/stop/pause taking
// effect at a block — are pinned in mixer_verify, which pumps Process directly
// (cf. metronome transport, covered by metronome_verify, not here). At this
// boundary we assert the resting state and that the calls are null-safe.
void TestMixerTransportIsNullSafe(kb_engine* engine) {
  Check(
      kb_mixer_position(engine) == 0,
      "mixer: a fresh engine rests at frame 0"
  );
  Check(
      kb_mixer_is_playing(engine) == 0,
      "mixer: a fresh engine is not playing"
  );

  kb_mixer_seek(engine, 4321);
  kb_mixer_play(engine);
  kb_mixer_pause(engine);
  kb_mixer_stop(engine);  // no track, no device: must not crash

  kb_mixer_pause(nullptr);  // a null engine is a no-op, not a crash
  kb_mixer_seek(nullptr, 0);
  Check(kb_mixer_position(nullptr) == 0, "mixer: null engine position is 0");
}

// A null engine/path, an out-of-range track and a file that will not open are
// all KB_ERROR_INVALID_ARGUMENT — the load reports failure rather than crashing
// or silently half-loading.
void TestMixerLoadRejects(kb_engine* engine, const std::string& path) {
  Check(
      kb_mixer_load_track(engine, 0, nullptr) == KB_ERROR_INVALID_ARGUMENT,
      "load: a null path is rejected"
  );
  Check(
      kb_mixer_load_track(engine, 999, path.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "load: an out-of-range track is rejected"
  );
  Check(
      kb_mixer_load_track(engine, 0, "/nonexistent/kitbag.wav") ==
          KB_ERROR_INVALID_ARGUMENT,
      "load: a file that will not open is rejected"
  );
  Check(
      kb_mixer_load_track(nullptr, 0, path.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "load: a null engine is rejected"
  );
  Check(
      kb_mixer_track_ready(nullptr, 0) == 0,
      "ready: a null engine reports not ready"
  );
  kb_mixer_unload_track(nullptr, 0);  // a null engine is a no-op, not a crash
}

// A4 (SPEC.md §4.1): tracks load from a file path — no PCM crosses the ABI.
// Exercises load/ready/unload end to end through the shared library over a WAV
// the tool writes (44.1kHz, so the load path also resamples). Runtime, not
// compile: track_ready must flip false→true on publish and back on unload.
void TestMixerLoadReadyUnload(kb_engine* engine, const std::string& path) {
  Check(
      kb_mixer_track_ready(engine, 0) == 0,
      "load: a fresh track is not ready"
  );
  Check(
      kb_mixer_load_track(engine, 0, path.c_str()) == KB_OK,
      "load: a real WAV loads"
  );
  Check(
      kb_mixer_track_ready(engine, 0) == 1,
      "load: the track is ready once its source is published"
  );
  Check(
      kb_mixer_track_frames(engine, 0) > 0,
      "load: the loaded track reports a nonzero length"
  );

  kb_mixer_unload_track(engine, 0);
  Check(
      kb_mixer_track_ready(engine, 0) == 0,
      "unload: the retired track is no longer ready"
  );
}

// Returns the process exit code, so main stays a list of what it runs.
int Report() {
  if (g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "abi_verify: ran %d checks, expected %d\n",
        g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (g_failures == 0) {
    std::printf("abi_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "abi_verify: %d failure(s)\n", g_failures);
  return 1;
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

  TestSetGridAcceptsAndNullChecks(engine);
  TestSetGridRejectsNonAscending(engine);
  TestSetGridRejectsNonFinite(engine);
  TestSetGridRejectsOversize(engine);
  TestClearGrid(engine);
  TestMixerTransportIsNullSafe(engine);

  const std::filesystem::path wav =
      std::filesystem::temp_directory_path() / "kitbag_abi_mixer.wav";
  if (!media_test::WriteWav(wav.string(), 1000)) {
    std::fprintf(stderr, "abi_verify: could not write the mixer fixture\n");
    kb_engine_destroy(engine);
    return 1;
  }
  TestMixerLoadRejects(engine, wav.string());
  TestMixerLoadReadyUnload(engine, wav.string());
  std::filesystem::remove(wav);

  kb_engine_destroy(engine);
  return Report();
}
