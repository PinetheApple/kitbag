#include <cmath>
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
int soundCalls = 0;
int32_t soundSlot = -1;

constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();
constexpr double kInfinity = std::numeric_limits<double>::infinity();
constexpr double kBeyondInt32 = 1e10;
constexpr int64_t kLongTrackFrames = (int64_t{1} << 40) + 1;
constexpr int32_t kTrackKey = -5;
constexpr const char* kSoundPath = "/files/click_sounds/a.wav";
constexpr double kEndFrame = 152965.0;
constexpr double kBeatFrames = 21209.9;
constexpr int32_t kBeatsPerBar = 3;
constexpr bool kClickOn = true;
constexpr bool kClickOff = false;
const double kBeyondExactFrame =
    std::nextafter(static_cast<double>(KB_MAX_EXACT_FRAME), kInfinity);

std::string songCalls;
kb_result countResult = KB_OK;
kb_result playResult = KB_OK;
kb_result startResult = KB_OK;
uint64_t countedEnd = 0;
int32_t countedStartClick = -1;
uint64_t playedFrom = 0;
uint64_t startedAt = 0;
int32_t startedSlot = -1;
int32_t selectedSlot = -1;
int32_t intentRead = 0;
uint64_t anchoredAt = 0;
uint64_t gridAnchoredAt = 0;
constexpr double kSongPos = 83.25;
constexpr double kSongBpm = 121.5;
constexpr double kSongRate = 1.25;
constexpr uint64_t kRenderedFrames = 96000;

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

void expectSlotRefused(double slot) {
  soundCalls = 0;
  if (kitbag::commandLoadCustomSound(slot, kSoundPath) != KB_ERROR_INVALID_ARGUMENT) {
    fail("custom sound load not refused", slot, 0);
  }
  kitbag::commandClearCustomSound(slot);
  if (kitbag::commandCustomSoundLoaded(slot)) fail("custom sound reads loaded", slot, 0);
  if (soundCalls != 0) fail("custom sound slot reached the engine", slot, 0);
}

void expectSlotSent(double slot, int32_t wantSlot) {
  soundCalls = 0;
  if (kitbag::commandLoadCustomSound(slot, kSoundPath) != KB_OK) {
    fail("custom sound load not accepted", slot, 0);
  }
  kitbag::commandClearCustomSound(slot);
  if (!kitbag::commandCustomSoundLoaded(slot)) fail("custom sound reads empty", slot, 0);
  constexpr int kLoadClearPoll = 3;
  if (soundCalls != kLoadClearPoll || soundSlot != wantSlot) {
    fail("custom sound sent wrong slot", slot, soundSlot);
  }
}

void expectSongCountIn(double endFrame, int32_t want, const std::string& wantCalls,
                       bool startClick = kClickOff) {
  songCalls.clear();
  const int32_t got = kitbag::commandSongCountIn(endFrame, kBeatFrames, kBeatsPerBar, startClick);
  if (got != want || songCalls != wantCalls) {
    std::fprintf(stderr, "song count-in %g: %d, calls '%s'\n", endFrame, got, songCalls.c_str());
    ++failures;
  }
  if (got == KB_OK && countedStartClick != static_cast<int32_t>(startClick)) {
    fail("song count-in lost its click flag", endFrame, countedStartClick);
  }
}

void expectSongCountInComposed() {
  expectSongCountIn(kEndFrame, KB_OK, "count play start ");
  if (countedEnd != playedFrom || static_cast<double>(playedFrom) != kEndFrame) {
    fail("song count-in split its end frame", kEndFrame, static_cast<double>(playedFrom));
  }
  expectSongCountIn(kEndFrame, KB_OK, "count play start ", kClickOn);
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
  startResult = KB_ERROR_DEVICE_START_FAILED;
  expectSongCountIn(kEndFrame, KB_ERROR_DEVICE_START_FAILED, "count play start stop pause ");
  startResult = KB_OK;
}

void expectSongTransport(void (*command)(), const char* what, const std::string& wantCalls) {
  songCalls.clear();
  command();
  if (songCalls != wantCalls) {
    std::fprintf(stderr, "%s: calls '%s'\n", what, songCalls.c_str());
    ++failures;
  }
}

void expectServiceStartCannotRestart() {
  songCalls.clear();
  kitbag::commandStandaloneStartNow();
  if (songCalls != "start-at start ") fail(("service start: " + songCalls).c_str(), 0, 0);
  if (startedAt != kRenderedFrames) fail("service start frame", 0, static_cast<double>(startedAt));
  if (startedSlot != KB_METRONOME_SLOT_STANDALONE) fail("service start slot", 0, startedSlot);
}

void expectAnchor(double atFrame, double bpm, const std::string& wantCalls) {
  songCalls.clear();
  kitbag::commandMetronomeAnchorExternal(kSongPos, atFrame, bpm);
  if (songCalls != wantCalls) fail(("anchor: " + songCalls).c_str(), atFrame, bpm);
}

void expectAnchorExternal() {
  expectAnchor(kEndFrame, kSongBpm, "anchor start ");
  if (static_cast<double>(anchoredAt) != kEndFrame) fail("anchor frame", kEndFrame, 0);
  expectAnchor(kNaN, kSongBpm, "");
  expectAnchor(-1, kSongBpm, "");
  expectAnchor(kEndFrame + 0.5, kSongBpm, "");
  expectAnchor(kBeyondExactFrame, kSongBpm, "");
  expectAnchor(kEndFrame, kNaN, "");
}

void expectGridAnchor(double atFrame, double rate, const std::string& wantCalls) {
  songCalls.clear();
  kitbag::commandMetronomeAnchorGrid(kSongPos, atFrame, rate);
  if (songCalls != wantCalls) fail(("grid anchor: " + songCalls).c_str(), atFrame, rate);
}

void expectAnchorGrid() {
  expectGridAnchor(kEndFrame, kSongRate, "grid-anchor start ");
  if (static_cast<double>(gridAnchoredAt) != kEndFrame) fail("grid anchor frame", kEndFrame, 0);
  expectGridAnchor(kNaN, kSongRate, "");
  expectGridAnchor(-1, kSongRate, "");
  expectGridAnchor(kEndFrame + 0.5, kSongRate, "");
  expectGridAnchor(kBeyondExactFrame, kSongRate, "");
  expectGridAnchor(kEndFrame, kNaN, "");
  expectGridAnchor(kEndFrame, 0.0, "");
  expectGridAnchor(kEndFrame, -kSongRate, "");
}

void expectSelect(int32_t intent, const std::string& wantCalls) {
  songCalls.clear();
  intentRead = intent;
  kitbag::commandMetronomeSelectSlot(KB_METRONOME_SLOT_PLAY_ALONG);
  if (songCalls != wantCalls) fail(("select: " + songCalls).c_str(), intent, 0);
  if (selectedSlot != KB_METRONOME_SLOT_PLAY_ALONG) fail("select slot", intent, selectedSlot);
}

void expectPlayAlongStops() {
  expectSongTransport(kitbag::commandPlayAlongClickStop, "play along click stop",
                      "stop-play-along ");
  selectedSlot = -1;
  expectSongTransport(kitbag::commandPlayAlongEnd, "play along end", "stop-play-along select ");
  if (selectedSlot != KB_METRONOME_SLOT_STANDALONE) fail("play along end slot", 0, selectedSlot);
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

extern "C" kb_result kb_metronome_load_custom_sound(kb_engine*, int32_t slot, const char*) {
  ++soundCalls;
  soundSlot = slot;
  return KB_OK;
}

extern "C" void kb_metronome_clear_custom_sound(kb_engine*, int32_t slot) {
  ++soundCalls;
  soundSlot = slot;
}

extern "C" int32_t kb_metronome_custom_sound_loaded(const kb_engine*, int32_t slot) {
  ++soundCalls;
  soundSlot = slot;
  return 1;
}

static const char* onSlot(int32_t slot, const char* call) {
  return slot == KB_METRONOME_SLOT_STANDALONE ? call : "wrong-slot ";
}

extern "C" kb_result kb_metronome_slot_count_in_at(kb_engine*, int32_t slot, uint64_t end, double,
                                                   int32_t, int32_t startClick) {
  songCalls += onSlot(slot, "count ");
  countedEnd = end;
  countedStartClick = startClick;
  return countResult;
}

extern "C" kb_result kb_mixer_play_at(kb_engine*, uint64_t start) {
  songCalls += "play ";
  playedFrom = start;
  return playResult;
}

extern "C" uint64_t kb_engine_frames_rendered(const kb_engine*) { return kRenderedFrames; }
extern "C" void kb_metronome_start(kb_engine*) { songCalls += "restart "; }
extern "C" void kb_metronome_slot_start_at(kb_engine*, int32_t slot, uint64_t frame) {
  songCalls += "start-at ";
  startedSlot = slot;
  startedAt = frame;
}
extern "C" void kb_metronome_select_slot(kb_engine*, int32_t slot) {
  songCalls += "select ";
  selectedSlot = slot;
}
extern "C" int32_t kb_metronome_intends_to_play(const kb_engine*) { return intentRead; }
extern "C" void kb_metronome_anchor_external(kb_engine*, double songPos, uint64_t frame,
                                             double bpm) {
  songCalls += "anchor ";
  anchoredAt = frame;
  if (songPos != kSongPos || bpm != kSongBpm) fail("anchor args", songPos, bpm);
}
extern "C" void kb_metronome_anchor_grid(kb_engine*, double songPos, uint64_t frame,
                                         double rate) {
  songCalls += "grid-anchor ";
  gridAnchoredAt = frame;
  if (songPos != kSongPos || rate != kSongRate) fail("grid anchor args", songPos, rate);
}
extern "C" void kb_metronome_slot_stop(kb_engine*, int32_t slot) {
  songCalls += slot == KB_METRONOME_SLOT_PLAY_ALONG ? "stop-play-along " : onSlot(slot, "stop ");
}
extern "C" void kb_metronome_slot_pause(kb_engine*, int32_t slot) {
  songCalls += onSlot(slot, "click-pause ");
}
extern "C" void kb_mixer_pause(kb_engine*) { songCalls += "pause "; }
extern "C" void kb_mixer_stop(kb_engine*) { songCalls += "mixer-stop "; }

extern "C" kb_result kb_engine_start(kb_engine*) {
  songCalls += "start ";
  return startResult;
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

  expectSlotRefused(kNaN);
  expectSlotRefused(0.5);
  expectSlotRefused(kInfinity);
  expectSlotRefused(kBeyondInt32);
  expectSlotSent(1, 1);

  expectSongCountInComposed();
  expectSongTransport(kitbag::commandSongPause, "song pause", "click-pause pause ");
  expectSongTransport(kitbag::commandSongStop, "song stop", "stop mixer-stop ");

  expectServiceStartCannotRestart();
  expectAnchorExternal();
  expectAnchorGrid();
  expectSelect(1, "select start ");
  expectSelect(0, "select ");
  expectPlayAlongStops();

  return failures == 0 ? 0 : 1;
}
