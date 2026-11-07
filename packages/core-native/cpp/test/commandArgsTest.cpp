#include <cstdint>
#include <cstdio>
#include <limits>
#include <string>

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
int keyReads = 0;
int32_t keyTrack = 0;

constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();
constexpr double kInfinity = std::numeric_limits<double>::infinity();
constexpr double kBeyondInt32 = 1e10;
constexpr int64_t kLongTrackFrames = (int64_t{1} << 40) + 1;
constexpr int32_t kTrackKey = -5;
constexpr double kEndFrame = 152965.0;
constexpr double kBeatFrames = 21209.9;
constexpr int32_t kBeatsPerBar = 3;
constexpr double kBeyondExactFrame = 9007199254740994.0;

std::string songCalls;
kb_result countResult = KB_OK;
kb_result playResult = KB_OK;
uint64_t countedEnd = 0;
uint64_t playedFrom = 0;

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

void expectKeyRefused(double track) {
  keyReads = 0;
  if (kitbag::commandMixerTrackPitch(track) != 0) fail("key not zero", track, 0);
  if (keyReads != 0) fail("key reached the engine", track, 0);
}

void expectKeyRead(double track, int32_t wantTrack) {
  keyReads = 0;
  const int32_t key = kitbag::commandMixerTrackPitch(track);
  if (keyReads != 1 || keyTrack != wantTrack) fail("key read wrong track", track, key);
  if (key != kTrackKey) fail("key not passed through", track, key);
}

void expectSongCountIn(double endFrame, int32_t want, const std::string& wantCalls) {
  songCalls.clear();
  const int32_t got = kitbag::commandSongCountIn(endFrame, kBeatFrames, kBeatsPerBar);
  if (got != want || songCalls != wantCalls) {
    std::fprintf(stderr, "song count-in %g: %d, calls '%s'\n", endFrame, got, songCalls.c_str());
    ++failures;
  }
}

void expectSongCountInComposed() {
  expectSongCountIn(kEndFrame, KB_OK, "count play start ");
  if (countedEnd != playedFrom || static_cast<double>(playedFrom) != kEndFrame) {
    fail("song count-in split its end frame", kEndFrame, static_cast<double>(playedFrom));
  }
  expectSongCountIn(kNaN, KB_ERROR_INVALID_ARGUMENT, "");
  expectSongCountIn(-1, KB_ERROR_INVALID_ARGUMENT, "");
  expectSongCountIn(kEndFrame + 0.5, KB_ERROR_INVALID_ARGUMENT, "");
  expectSongCountIn(kBeyondExactFrame, KB_ERROR_INVALID_ARGUMENT, "");
  playResult = KB_ERROR_BUSY;
  expectSongCountIn(kEndFrame, KB_ERROR_BUSY, "count play stop ");
  playResult = KB_OK;
  countResult = KB_ERROR_BUSY;
  expectSongCountIn(kEndFrame, KB_ERROR_BUSY, "count ");
  countResult = KB_OK;
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

extern "C" int32_t kb_mixer_track_pitch(const kb_engine*, int32_t track) {
  ++keyReads;
  keyTrack = track;
  return kTrackKey;
}

extern "C" int64_t kb_mixer_track_frames(const kb_engine*, int32_t track) {
  ++framesCalls;
  framesTrack = track;
  return kLongTrackFrames;
}

extern "C" kb_result kb_metronome_count_in_at(kb_engine*, uint64_t end, double, int32_t) {
  songCalls += "count ";
  countedEnd = end;
  return countResult;
}

extern "C" kb_result kb_mixer_play_at(kb_engine*, uint64_t start) {
  songCalls += "play ";
  playedFrom = start;
  return playResult;
}

extern "C" void kb_metronome_stop(kb_engine*) { songCalls += "stop "; }

extern "C" kb_result kb_engine_start(kb_engine*) {
  songCalls += "start ";
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

  expectFramesRefused(kNaN);
  expectFramesRefused(1.5);
  expectFramesRefused(kInfinity);
  expectFramesRead(2, 2);

  expectKeyRefused(kNaN);
  expectKeyRefused(1.5);
  expectKeyRefused(kInfinity);
  expectKeyRead(2, 2);

  expectSongCountInComposed();

  return failures == 0 ? 0 : 1;
}
