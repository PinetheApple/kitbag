import {
  KITBAG_HOST_OBJECT_KEY,
  KB_POLY_PHASE_NONE,
  KB_RAMP_STATE,
  KB_RESULT,
  KB_STOPPED_BEAT,
  KB_TUNER_NO_NOTE,
  KB_TUNER_NO_STRING,
  KB_TUNING_STATUS,
  KB_WRONG_STRING,
  type KitbagHostObject,
} from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  configureMetronomeRuntime,
  DEFAULT_BPM,
  metronomeStore,
  type MetronomeCommands,
} from '@kitbag/core-state';

const PHASE_STEPS = 1000;
const MAX_PHASE = (PHASE_STEPS - 1) / PHASE_STEPS;

function readBoundedQuery(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = new URLSearchParams(globalThis.location.search).get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const webCommands: MetronomeCommands = {
  start: () => Promise.resolve(0),
  engineHold: () => Promise.resolve(KB_RESULT.KB_OK),
  engineRelease: () => undefined,
  metronomeStart: () => undefined,
  metronomeStop: () => undefined,
  metronomePause: () => undefined,
  setTempo: () => undefined,
  setBeats: () => undefined,
  setSubdivision: () => undefined,
  setAccent: () => undefined,
  setPoly: () => undefined,
  setPolyAccent: () => undefined,
  setPolyAgainst: () => undefined,
  setSounds: () => undefined,
  previewSound: () => undefined,
  setCountIn: () => undefined,
  setVolume: () => undefined,
  setLatencyOffset: () => undefined,
  setRamp: () => undefined,
  setBarMute: () => undefined,
};

const initialBpm = readBoundedQuery(
  'bpm',
  DEFAULT_BPM,
  BPM_BOUNDS.min,
  BPM_BOUNDS.max,
);

const presentationHost: KitbagHostObject = Object.freeze({
  bar_phase: Math.min(
    Math.round(readBoundedQuery('phase', 0, 0, 1) * PHASE_STEPS) / PHASE_STEPS,
    MAX_PHASE,
  ),
  current_beat: Math.floor(
    readBoundedQuery(
      'beat',
      KB_STOPPED_BEAT,
      KB_STOPPED_BEAT,
      metronomeStore.getState().beatsPerBar - 1,
    ),
  ),
  current_poly_beat: KB_STOPPED_BEAT,
  poly_downbeat_phase: KB_POLY_PHASE_NONE,
  counting_in: 0,
  bar_muted: 0,
  bar_mute_position: -1,
  count_in_bar: -1,
  count_in_bars_total: 0,
  ramp_state: KB_RAMP_STATE.KB_RAMP_STATE_OFF,
  ramp_next_bpm: 0,
  ramp_remaining: 0,
  ramp_step_progress: 0,
  get current_bpm() {
    return metronomeStore.getState().bpm;
  },
  frames_rendered: 0,
  tuner_snapshot: 0,
  player_position: 0,
  mixer_position: 0,
  mixer_playing: 0,
  engine_sample_rate: 0,
  // The engine's tuner rest state (TuningMode::RestState): nothing heard.
  tuner_measurement_id: 0,
  tuner_can_hear_note: 0,
  tuner_current_string: KB_TUNER_NO_STRING,
  tuner_possible_wrong_string: KB_TUNER_NO_STRING,
  tuner_wrong_string_direction: KB_WRONG_STRING.KB_WRONG_STRING_NONE,
  tuner_status: KB_TUNING_STATUS.KB_TUNING_NOT_MEASURED,
  tuner_target_midi: KB_TUNER_NO_NOTE,
  tuner_measured_midi: 0,
  tuner_error_cents: 0,
  tuner_in_tune_ratio: 0,
  tuner_in_tune_threshold_cents: 0,
  tuner_listening_paused: 0,
  tuner_no_sound_issue: 0,
});

(globalThis as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] =
  presentationHost;

configureMetronomeRuntime({
  commands: webCommands,
  nowFrame: () => presentationHost.frames_rendered,
  engineBpm: () => presentationHost.current_bpm,
});

metronomeStore.getState().setTempo(initialBpm);
