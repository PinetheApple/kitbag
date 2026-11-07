#include <cstdint>
#include <cstdio>
#include <limits>

#include "KitbagCommands.h"
#include "KitbagEngine.h"
#include "kitbag_api.h"

namespace {

char engineStorage;
int failures = 0;
int pitchCalls = 0;
int32_t sentTrack = 0;
int32_t sentSemitones = 0;

constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();
constexpr double kInfinity = std::numeric_limits<double>::infinity();
constexpr double kBeyondInt32 = 1e10;

void fail(const char* what, double track, double value) {
  std::fprintf(stderr, "%s: track %g, value %g\n", what, track, value);
  ++failures;
}

void expectPitchRefused(double track, double semitones) {
  pitchCalls = 0;
  if (kitbag::commandMixerSetTrackPitch(track, semitones) != KB_ERROR_INVALID_ARGUMENT) {
    fail("pitch not refused", track, semitones);
  }
  if (pitchCalls != 0) fail("pitch reached the engine", track, semitones);
}

void expectPitchSent(double track, double semitones, int32_t wantTrack, int32_t wantSemitones) {
  pitchCalls = 0;
  if (kitbag::commandMixerSetTrackPitch(track, semitones) != KB_OK) {
    fail("pitch not accepted", track, semitones);
  }
  if (pitchCalls != 1 || sentTrack != wantTrack || sentSemitones != wantSemitones) {
    fail("pitch sent wrong", track, semitones);
  }
}

}  // namespace

namespace kitbag {
kb_engine* kitbagEngine() { return reinterpret_cast<kb_engine*>(&engineStorage); }
}  // namespace kitbag

extern "C" kb_result kb_mixer_set_track_pitch(kb_engine*, int32_t track, int32_t semitones) {
  ++pitchCalls;
  sentTrack = track;
  sentSemitones = semitones;
  return KB_OK;
}

int main() {
  expectPitchRefused(1, 2.7);
  expectPitchRefused(1, kNaN);
  expectPitchRefused(1, kInfinity);
  expectPitchRefused(1, -kInfinity);
  expectPitchRefused(1, kBeyondInt32);
  expectPitchRefused(1.5, 1);
  expectPitchRefused(kNaN, 1);
  expectPitchRefused(kInfinity, 1);
  expectPitchRefused(-kBeyondInt32, 1);

  expectPitchSent(3, -6, 3, -6);
  expectPitchSent(0, -0.0, 0, 0);

  return failures == 0 ? 0 : 1;
}
