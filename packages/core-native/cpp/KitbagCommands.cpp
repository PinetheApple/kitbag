// See KitbagCommands.h. SKELETON (#31): routes each command to the single engine
// (SPEC §4.5); not yet bound to the generated TurboModule (#33).

#include "KitbagCommands.h"

#include <cassert>

#include "KitbagEngine.h"
#include "kitbag_api.h"

namespace kitbag {

namespace {
// A command that arrives before kitbagInstall() ran carries a null engine
// (§4.5 install-ordering). The kb_* ABI already treats null as a no-op /
// KB_ERROR_INVALID_ARGUMENT, so forwarding it can never deref null; the assert
// surfaces the ordering bug in debug builds instead of failing silently.
kb_engine* commandEngine() {
  kb_engine* engine = kitbagEngine();
  assert(engine != nullptr && "command dispatched before kitbagInstall()");
  return engine;
}
}  // namespace

int32_t commandStart() { return kb_engine_start(commandEngine()); }
void commandStop() { kb_engine_stop(commandEngine()); }

void commandMetronomeStart(double anchorFrame) {
  // anchorFrame is a uint64 start frame carried as a double; the cast is exact
  // below 2^53 (kitbag_api.h), same convention as commandSetGrid.
  kb_metronome_start_at(commandEngine(), static_cast<uint64_t>(anchorFrame));
}

void commandSetTempo(double bpm) { kb_metronome_set_tempo(commandEngine(), bpm); }

int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame) {
  // anchorFrame is a uint64 frame carried as a double; the cast is exact below
  // 2^53 (kitbag_api.h), which is why no BigInt is needed on the JS side.
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
  // The ABI takes an int32 flag; map the boolean here so JS never encodes 0/1.
  kb_metronome_set_poly(commandEngine(), enabled ? 1 : 0, beats);
}
void commandSetSound(int32_t soundIndex) {
  kb_metronome_set_sound(commandEngine(), soundIndex);
}
void commandSetVolume(double volume) {
  kb_metronome_set_volume(commandEngine(), volume);
}
void commandSetLatencyOffset(double latencyMs) {
  kb_metronome_set_latency_offset(commandEngine(), latencyMs);
}

int32_t commandLoadTrack(int32_t track, const char* path) {
  return kb_mixer_load_track(commandEngine(), track, path);
}

}  // namespace kitbag
