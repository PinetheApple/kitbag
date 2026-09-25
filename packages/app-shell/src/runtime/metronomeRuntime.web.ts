import {
  KITBAG_HOST_OBJECT_KEY,
  KB_STOPPED_BEAT,
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
  metronomeStart: () => undefined,
  metronomeStop: () => undefined,
  setTempo: () => undefined,
  setBeats: () => undefined,
  setSubdivision: () => undefined,
  setAccent: () => undefined,
  setPoly: () => undefined,
  setSound: () => undefined,
  setVolume: () => undefined,
  setLatencyOffset: () => undefined,
  setRamp: () => undefined,
  setBarMute: () => undefined,
};

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
  current_bpm: readBoundedQuery(
    'bpm',
    DEFAULT_BPM,
    BPM_BOUNDS.min,
    BPM_BOUNDS.max,
  ),
  frames_rendered: 0,
  tuner_snapshot: 0,
  player_position: 0,
});

(globalThis as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] =
  presentationHost;

configureMetronomeRuntime({
  commands: webCommands,
  nowFrame: () => presentationHost.frames_rendered,
});

metronomeStore.getState().setTempo(presentationHost.current_bpm);
