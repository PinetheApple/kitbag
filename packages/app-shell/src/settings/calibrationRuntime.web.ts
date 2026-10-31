import { KB_RESULT, getOutputRoute } from '@kitbag/core-native';
import { metronomeStore, type CalibrationDeps } from '@kitbag/core-state';

import type * as Native from './calibrationRuntime.ts';

// The web build has no engine; a clock on performance.now, the base of a web
// touch timestamp, lets the screen run silently for layout work.
const PRESENTATION_RATE = 48_000;
const MS_PER_SECOND = 1000;
const NS_PER_MS = 1_000_000;

const presentationFrame = () =>
  (globalThis.performance.now() * PRESENTATION_RATE) / MS_PER_SECOND;

export const calibrationDeps: typeof Native.calibrationDeps = {
  startClick: () => Promise.resolve(KB_RESULT.KB_OK),
  stopClick: () => undefined,
  nowFrame: presentationFrame,
  readClockPair: () => {
    const now = globalThis.performance.now();
    return {
      frame: (now * PRESENTATION_RATE) / MS_PER_SECOND,
      monotonicNs: now * NS_PER_MS,
      sampleRate: PRESENTATION_RATE,
    };
  },
  getOutputRoute,
  watchOutputRoute: () => () => undefined,
  saveRouteLatency: () => Promise.resolve(),
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
} satisfies CalibrationDeps;
