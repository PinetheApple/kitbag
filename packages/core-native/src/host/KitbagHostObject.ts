// Polled realtime reads (SPEC §13.3): properties, not methods, so a worklet
// read allocates nothing. Never route these through React state.

export interface KitbagHostObject {
  /** kb_metronome_bar_phase — position within the bar, [0, 1). Beat sweep. */
  readonly bar_phase: number;
  /** kb_metronome_current_beat — beat index within the bar, -1 when stopped. */
  readonly current_beat: number;
  /** kb_metronome_current_poly_beat — poly beat, -1 when stopped, off, gridded or just resized. */
  readonly current_poly_beat: number;
  /** kb_metronome_counting_in — 1 while the count-in plays, else 0. */
  readonly counting_in: number;
  /** kb_metronome_current_bpm — effective BPM including ramp progress. */
  readonly current_bpm: number;
  /** kb_engine_frames_rendered — monotonic master clock, in frames. */
  readonly frames_rendered: number;
  /** kb_tuner_snapshot — packed reading; decode with src/host/snapshot.ts. */
  readonly tuner_snapshot: number;
  /** kb_player_position — single-source transport position, in frames. */
  readonly player_position: number;
}

/** The stopped sentinel of current_beat and current_poly_beat. */
export const KB_STOPPED_BEAT = -1;

/** Must equal kHostObjectKey in cpp/KitbagHostObject.h. */
export const KITBAG_HOST_OBJECT_KEY = '__KitbagHostObject';

interface HostGlobal {
  [KITBAG_HOST_OBJECT_KEY]?: KitbagHostObject;
}

/** JS-thread setup only; worklets read the global property directly. */
export function getKitbagHostObject(): KitbagHostObject {
  const host = (globalThis as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
  if (host === undefined) {
    throw new Error(
      `${KITBAG_HOST_OBJECT_KEY} is not installed. The core-native module must ` +
        'install the JSI HostObject before any read (SPEC §13.2).',
    );
  }
  return host;
}
