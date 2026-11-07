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
int framesCalls = 0;
int32_t framesTrack = 0;

constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();
constexpr double kInfinity = std::numeric_limits<double>::infinity();
constexpr double kBeyondInt32 = 1e10;
constexpr int64_t kLongTrackFrames = (int64_t{1} << 40) + 1;

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

void expectFramesRefused(double track) {
  framesCalls = 0;
  if (kitbag::commandMixerTrackFrames(track) != 0.0) fail("frames not zero", track, 0);
  if (framesCalls != 0) fail("frames reached the engine", track, 0);
}

void expectFramesRead(double track, int32_t wantTrack) {
  framesCalls = 0;
  const double frames = kitbag::commandMixerTrackFrames(track);
  if (framesCalls != 1 || framesTrack != wantTrack) fail("frames read wrong track", track, frames);
  if (frames != static_cast<double>(kLongTrackFrames)) fail("frames not exact", track, frames);
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

extern "C" int64_t kb_mixer_track_frames(const kb_engine*, int32_t track) {
  ++framesCalls;
  framesTrack = track;
  return kLongTrackFrames;
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

  expectFramesRefused(kNaN);
  expectFramesRefused(1.5);
  expectFramesRefused(kInfinity);
  expectFramesRead(2, 2);

  return failures == 0 ? 0 : 1;
}
