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
