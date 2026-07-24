// Native routing for the TurboModule COMMAND path (SPEC §13.2): the infrequent,
// write-mostly calls declared in src/NativeKitbagCommands.ts, each mapped 1:1
// onto the flat C ABI. This is deliberately NOT the realtime read path — polled
// 60fps reads go through the JSI HostObject (§13.3), never here.
//
// SKELETON (#31): every function below routes to kitbagEngine() — the ONE engine
// the HostObject holds (SPEC §4.5) — so a command and a realtime read address the
// same engine, never two. DEFERRED to #33: bind these to the codegen-generated
// KitbagCommandsSpec (JNI/C++ TurboModule) so JS `getKitbagCommands()` reaches
// them; that binding needs the live RN runtime this box cannot build.
//
// SPEC §13.7: signatures use the C ABI types from kitbag_api.h; no bound or enum
// value is restated here.

#ifndef KITBAG_COMMANDS_H
#define KITBAG_COMMANDS_H

#include <cstdint>

namespace kitbag {

// Transport. start() returns a kb_result code (0 == KB_OK); stop() is infallible.
// metronomeStart() maps to kb_metronome_start_at: opening the device (start())
// does not move the transport; the metronome's running_ / bar_phase advance only
// after this. anchorFrame is a uint64 start frame carried as a double (exact
// below 2^53, kitbag_api.h), same convention as commandSetGrid's anchorFrame.
int32_t commandStart();
void commandStop();
void commandMetronomeStart(double anchorFrame);

// Tempo & grid. setGrid returns a kb_result code and takes the array count the
// native glue supplies; anchorFrame crosses as a double and is exact to 2^53
// frames (~5,900 years at 48kHz), so no BigInt (kitbag_api.h).
void commandSetTempo(double bpm);
int32_t commandSetGrid(const double* beatTimesSec, int32_t count, double anchorFrame);

// Metronome setters (all void in the ABI). accent and soundIndex pass through
// unchanged — the caller sources them from the generated enum/table (§13.7).
void commandSetBeats(int32_t beatsPerBar);
void commandSetSubdivision(int32_t subdivision);
void commandSetAccent(int32_t beatIndex, int32_t accent);
void commandSetPoly(bool enabled, int32_t beats);
void commandSetSound(int32_t soundIndex);
void commandSetVolume(double volume);
void commandSetLatencyOffset(double latencyMs);

// Mixer. Returns a kb_result code; poll readiness via the HostObject (§13.3).
int32_t commandLoadTrack(int32_t track, const char* path);

}  // namespace kitbag

#endif  // KITBAG_COMMANDS_H
