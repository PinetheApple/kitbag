// The JSI HostObject surface — the polled realtime read path (SPEC §13.2, §13.3).
//
// A C++ jsi::HostObject (packages/core-native/cpp/KitbagHostObject.cpp) is
// installed ONCE on the JS runtime's global. It holds the single kb_engine*
// (SPEC §4.5) and is the only holder; the sibling TurboModule (commands) reaches
// the engine through it, not by owning its own pointer. Each method calls
// straight into the C ABI, synchronously, with zero serialisation — the direct
// analogue of the Dart FFI call it replaces.
//
// §13.3, the rule that matters: these reads are what a Reanimated worklet polls
// on the UI thread each frame — reading `global.__KitbagHostObject.bar_phase`
// (and its siblings) as a plain property, writing a SharedValue. They are
// number-valued PROPERTIES, not methods: a JSI double property is allocation-free
// per access, whereas a callable would allocate a jsi::Function per frame, which
// §13.3 forbids on the 60fps path. They must NEVER be routed through React state
// or a JS-thread poll. This file is only the typed contract; it deliberately
// holds no state and starts no loop.
//
// This is a SKELETON. There is no native build wired until #31, so nothing is
// installed on `global` at runtime yet — getKitbagHostObject() throws until then.
// The C++ that fulfils this contract is uncompiled scaffolding (see cpp/).

/**
 * Synchronous polled reads into the C ABI. Every read is a `number`-valued
 * PROPERTY (JSI double), not a method: reading it re-invokes the underlying C ABI
 * call in C++ `get()` and returns the value directly, allocating nothing per
 * access — the 60fps requirement (§13.3). The engine's u64/i64 frame counts are
 * exact to 2^53 (~5,900 years at 48kHz), so no BigInt crosses (SPEC §13.2).
 */
export interface KitbagHostObject {
  /** kb_metronome_bar_phase — position within the bar, [0, 1). Beat sweep. */
  readonly bar_phase: number;
  /** kb_metronome_current_beat — beat index within the bar, -1 when stopped. */
  readonly current_beat: number;
  /** kb_metronome_current_bpm — effective BPM including ramp progress. */
  readonly current_bpm: number;
  /** kb_engine_frames_rendered — monotonic master clock, in frames. */
  readonly frames_rendered: number;
  /** kb_tuner_snapshot — packed reading; decode with src/host/snapshot.ts. */
  readonly tuner_snapshot: number;
  /** kb_player_position — single-source transport position, in frames. */
  readonly player_position: number;

  // Tuner string-aware state. Each property is one field of a fresh
  // kb_tuner_read_state copy, so two reads may straddle an analysis hop. A
  // reader wanting one consistent hop reads tuner_measurement_id before and
  // after its other fields and retries if it moved.

  /** kb_tuner_state.measurement_id — +1 per hop, frozen while paused. */
  readonly tuner_measurement_id: number;
  /** kb_tuner_state.can_hear_note — 1 while a note is held, else 0. */
  readonly tuner_can_hear_note: number;
  /** kb_tuner_state.current_string — string index, or KB_TUNER_NO_STRING. */
  readonly tuner_current_string: number;
  /** kb_tuner_state.possible_wrong_string — string index, or KB_TUNER_NO_STRING. */
  readonly tuner_possible_wrong_string: number;
  /** kb_tuner_state.wrong_string_direction — a KB_WRONG_STRING_* value. */
  readonly tuner_wrong_string_direction: number;
  /** kb_tuner_state.tuning_status — a KB_TUNING_* value. */
  readonly tuner_status: number;
  /** kb_tuner_state.target_midi — the error's reference, or KB_TUNER_NO_NOTE. */
  readonly tuner_target_midi: number;
  /** kb_tuner_state.measured_midi — fractional; 0 with no note. */
  readonly tuner_measured_midi: number;
  /** kb_tuner_state.tuning_error_cents — 1200*log2(measured / target). */
  readonly tuner_error_cents: number;
  /** kb_tuner_state.in_tune_ratio — [0, 1]; leaving the window resets it. */
  readonly tuner_in_tune_ratio: number;
  /** kb_tuner_state.in_tune_threshold_cents — in-tune window half-width. */
  readonly tuner_in_tune_threshold_cents: number;
  /** kb_tuner_state.listening_paused — 1 during a reset's pause, else 0. */
  readonly tuner_listening_paused: number;
  /** kb_tuner_state.no_sound_issue — 1 once nothing is heard for 20 s. */
  readonly tuner_no_sound_issue: number;
}

/**
 * The value `current_beat` carries while the metronome is stopped, per the
 * kb_metronome_current_beat contract. One owner: every LED row that seeds or
 * compares a beat index reads it from here rather than retyping -1 (§13.7).
 */
export const KB_STOPPED_BEAT = -1;

/**
 * The global key the C++ installer publishes the HostObject under. One owner of
 * this string: TS setup validates via it, and the worklet read path reads the
 * same key on the UI thread.
 */
export const KITBAG_HOST_OBJECT_KEY = '__KitbagHostObject';

interface HostGlobal {
  [KITBAG_HOST_OBJECT_KEY]?: KitbagHostObject;
}

/**
 * Fetch the installed HostObject, or throw if the native module has not
 * installed it. For JS-thread setup/validation only — the 60fps path reads the
 * `global.__KitbagHostObject.bar_phase` property directly inside a worklet
 * (SPEC §13.3), never through this JS-thread accessor.
 */
export function getKitbagHostObject(): KitbagHostObject {
  const host = (globalThis as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
  if (host === undefined) {
    throw new Error(
      `${KITBAG_HOST_OBJECT_KEY} is not installed. The core-native module must ` +
        'install the JSI HostObject before any read (SPEC §13.2). No native ' +
        'build is wired yet (#31).',
    );
  }
  return host;
}
