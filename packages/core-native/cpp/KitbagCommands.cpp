#include "KitbagCommands.h"

#include <cassert>

#include "KitbagEngine.h"
#include "kitbag_api.h"

namespace kitbag {

namespace {
// The kb_* ABI treats a null engine as a no-op; the assert surfaces a command
// sent before kitbagInstall() in debug builds.
kb_engine* commandEngine() {
  kb_engine* engine = kitbagEngine();
  assert(engine != nullptr && "command dispatched before kitbagInstall()");
  return engine;
}

int32_t flag(bool value) { return value ? 1 : 0; }
}  // namespace

int32_t commandStart() { return kb_engine_start(commandEngine()); }
void commandStop() { kb_engine_stop(commandEngine()); }

void commandMetronomeStart(double anchorFrame) {
  kb_metronome_start_at(commandEngine(), static_cast<uint64_t>(anchorFrame));
}
void commandMetronomeStop() { kb_metronome_stop(commandEngine()); }
void commandMetronomePause() { kb_metronome_pause(commandEngine()); }

void commandSetTempo(double bpm) { kb_metronome_set_tempo(commandEngine(), bpm); }

int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame) {
  return kb_metronome_set_grid(commandEngine(), beatTimesSec, count,
                               static_cast<uint64_t>(anchorFrame));
}

void commandSetBeats(int32_t beatsPerBar, int32_t denominator) {
  kb_metronome_set_beats(commandEngine(), beatsPerBar, denominator);
}
void commandSetSubdivision(int32_t subdivision) {
  kb_metronome_set_subdivision(commandEngine(), subdivision);
}
void commandSetAccent(int32_t beatIndex, int32_t accent) {
  kb_metronome_set_accent(commandEngine(), beatIndex, accent);
}
void commandSetPoly(bool enabled, int32_t beats) {
  kb_metronome_set_poly(commandEngine(), flag(enabled), beats);
}
void commandSetPolyAccent(int32_t beatIndex, int32_t accent) {
  kb_metronome_set_poly_accent(commandEngine(), beatIndex, accent);
}
void commandSetSounds(int32_t normalSound, int32_t accentSound) {
  kb_metronome_set_sounds(commandEngine(), normalSound, accentSound);
}
void commandPreviewSound(int32_t sound, bool accented) {
  kb_metronome_preview_sound(commandEngine(), sound, flag(accented));
}
void commandSetCountIn(int32_t bars, bool distinct, int32_t sound) {
  kb_metronome_set_count_in(commandEngine(), bars, flag(distinct), sound);
}
void commandSetVolume(double volume) {
  kb_metronome_set_volume(commandEngine(), volume);
}
void commandSetLatencyOffset(double latencyMs) {
  kb_metronome_set_latency_offset(commandEngine(), latencyMs);
}

void commandSetRamp(
    bool enabled,
    double startBpm,
    double endBpm,
    double duration,
    int32_t unit,
    bool loop) {
  kb_metronome_set_ramp(commandEngine(), flag(enabled), startBpm, endBpm,
                        duration, unit, flag(loop));
}
void commandSetBarMute(bool enabled, int32_t playBars, int32_t muteBars) {
  kb_metronome_set_bar_mute(commandEngine(), flag(enabled), playBars, muteBars);
}

int32_t commandLoadTrack(int32_t track, const char* path) {
  return kb_mixer_load_track(commandEngine(), track, path);
}

}  // namespace kitbag
