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
  /** kb_metronome_bar_muted — 1 while the bar-mute trainer silences the bar. */
  readonly bar_muted: number;
  /** kb_metronome_bar_mute_position — bar within the play+mute cycle, -1 when off, stopped or counting in. */
  readonly bar_mute_position: number;
  /** kb_metronome_count_in_bar — 0-based count-in bar, -1 when not counting in. */
  readonly count_in_bar: number;
  /** kb_metronome_count_in_bars_total — bars in the running count-in, fixed at its start; 0 when not counting in. */
  readonly count_in_bars_total: number;
  /** kb_metronome_ramp_state — a KB_RAMP_STATE value. */
  readonly ramp_state: number;
  /** kb_metronome_ramp_next_bpm — tempo of the next step, 0 unless stepping. */
  readonly ramp_next_bpm: number;
  /** kb_metronome_ramp_remaining — time to the next step in the ramp's unit (bars, seconds or minutes). */
  readonly ramp_remaining: number;
  /** kb_metronome_ramp_step_progress — elapsed fraction of the current interval, [0, 1]. */
  readonly ramp_step_progress: number;
  /** kb_engine_frames_rendered — monotonic master clock, in frames. */
  readonly frames_rendered: number;
  /** kb_tuner_snapshot — packed reading; decode with src/host/snapshot.ts. */
  readonly tuner_snapshot: number;
  /** kb_player_position — single-source transport position, in frames. */
  readonly player_position: number;
  /** kb_mixer_position — engine-rate song frame the stems are playing. */
  readonly mixer_position: number;
  /** kb_mixer_is_playing — 1 while the stems play, else 0. */
  readonly mixer_playing: number;
  /** kb_engine_sample_rate — the rate every engine frame count is in. */
  readonly engine_sample_rate: number;

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
