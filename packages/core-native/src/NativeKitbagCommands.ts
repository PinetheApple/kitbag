// TurboModule spec for the COMMAND path (SPEC §13.2): infrequent, write-only
// calls that map 1:1 onto the flat C ABI in
// native/audio_core/include/kitbag_api.h. Commands are codegen-typed and may be
// async — this is deliberately NOT the realtime read path. Polled 60fps reads
// (bar_phase, tuner_snapshot, …) go through the JSI HostObject (#30), never
// here.
//
// SPEC §13.6: JSI/TurboModule symbols live ONLY in @kitbag/core-native. Do not
// import from this file outside this package.
//
// SPEC §4.5 / §13.2: the single kb_engine* is owned by the JSI HostObject, which
// is the only holder of it. This module does NOT create or hold an engine
// pointer; the native TurboModule implementation (#31) routes each command to
// the process-wide engine the HostObject installs. There is one engine per
// process and one holder of it.
//
// SPEC §13.7 (one definition per constant): no cross-boundary constant is
// mirrored here. `kb_result` codes are returned raw as `number`; callers compare
// them against the generated `KbResult` constants (#30, src/generated/), never a
// hand-typed copy. The accent argument is a `KB_ACCENT_*` value the caller
// likewise sources from the generated accent enum. Bounds (grid count,
// volume/latency ranges) are enforced by the engine, not restated here.

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  // --- Engine / transport --------------------------------------------------

  // kb_engine_start: opens/starts the audio device. Returns a kb_result code
  // (0 = KB_OK); may fail with device-init/start errors, hence async + result.
  start(): Promise<number>;
  // kb_engine_stop: stops the device. Infallible in the ABI (void).
  stop(): void;

  // --- Metronome tempo & grid ----------------------------------------------

  // kb_metronome_set_tempo(bpm).
  setTempo(bpm: Double): void;

  // kb_metronome_set_grid(beat_times_sec, count, anchor_frame). `count` is the
  // array length, supplied by the native glue. `anchorFrame` is a uint64 engine
  // frame carried as a JS double — exact to 2^53 frames (~5,900 years at 48kHz),
  // so No BigInt (kitbag_api.h). Returns a kb_result code; fails on an empty,
  // non-ascending, non-finite grid or a count above KB_MAX_GRID_BEATS.
  setGrid(beatTimesSec: readonly Double[], anchorFrame: Double): Promise<number>;

  // --- Metronome setters (all void in the ABI) -----------------------------

  // kb_metronome_set_beats(beats_per_bar).
  setBeats(beatsPerBar: Int32): void;
  // kb_metronome_set_subdivision(subdivision).
  setSubdivision(subdivision: Int32): void;
  // kb_metronome_set_accent(beat_index, accent). `accent` is a KB_ACCENT_* value
  // from the generated accent enum (#30), passed through unchanged.
  setAccent(beatIndex: Int32, accent: Int32): void;
  // kb_metronome_set_poly(enabled, beats). ABI takes int32 enabled; the native
  // glue maps this boolean to 0/1.
  setPoly(enabled: boolean, beats: Int32): void;
  // kb_metronome_set_sound(sound_index). Index into the engine-owned soundNames
  // table (#30); never a hand-typed name here.
  setSound(soundIndex: Int32): void;
  // kb_metronome_set_volume(volume). Engine clamps to [0, 2].
  setVolume(volume: Double): void;
  // kb_metronome_set_latency_offset(latency_ms). Engine clamps to [-100, 100];
  // positive triggers earlier.
  setLatencyOffset(latencyMs: Double): void;

  // --- Mixer track loading -------------------------------------------------

  // kb_mixer_load_track(track, path). Returns a kb_result code; fails on an
  // out-of-range track or a file that will not open. Poll readiness separately
  // via the HostObject (#30) — loading is async.
  loadTrack(track: Int32, path: string): Promise<number>;
}

// Standard TurboModule accessor. This resolves the native module lazily at
// import time; it throws until the native implementation is registered (#31),
// which is expected at skeleton stage — nothing runtime-imports this yet.
export default TurboModuleRegistry.getEnforcing<Spec>('KitbagCommands');
