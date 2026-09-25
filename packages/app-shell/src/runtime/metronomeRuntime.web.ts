import {
  configureMetronomeRuntime,
  type MetronomeCommands,
} from '@kitbag/core-state';

interface PresentationHost {
  readonly bar_phase: number;
  readonly current_beat: number;
  readonly current_bpm: number;
  readonly frames_rendered: number;
  readonly tuner_snapshot: number;
  readonly player_position: number;
}

const KITBAG_HOST_OBJECT_KEY = '__KitbagHostObject';
const PHASE_STEPS = 1000;
const DEFAULT_PHASE = 0;
const DEFAULT_BEAT = 0;
const DEFAULT_BPM = 120;
const MAX_BEAT = 15;
const MIN_BPM = 20;
const MAX_BPM = 400;
function readBoundedQuery(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(
    new URLSearchParams(globalThis.location.search).get(name),
  );
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const barPhase = readBoundedQuery('phase', DEFAULT_PHASE, 0, 1);
const currentBeat = Math.floor(
  readBoundedQuery('beat', DEFAULT_BEAT, -1, MAX_BEAT),
);
const currentBpm = readBoundedQuery('bpm', DEFAULT_BPM, MIN_BPM, MAX_BPM);
const presentationHost: PresentationHost = Object.freeze({
  bar_phase: Math.round(barPhase * PHASE_STEPS) / PHASE_STEPS,
  current_beat: currentBeat,
  current_bpm: currentBpm,
  frames_rendered: 0,
  tuner_snapshot: 0,
  player_position: 0,
});

Object.defineProperty(globalThis, KITBAG_HOST_OBJECT_KEY, {
  configurable: false,
  enumerable: false,
  value: presentationHost,
  writable: false,
});

const webCommands = new Proxy({} as MetronomeCommands, {
  get: () => () => undefined,
});

configureMetronomeRuntime({
  commands: webCommands,
  nowFrame: () => presentationHost.frames_rendered,
});
