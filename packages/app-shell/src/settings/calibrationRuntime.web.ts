import { KB_RESULT, getOutputRoute } from '@kitbag/core-native';
import { metronomeStore, type CalibrationDeps } from '@kitbag/core-state';

import type * as Native from './calibrationRuntime.ts';
import { routeLatency } from './rigRuntime';

// The web build has no engine; a clock on performance.now, the base of a web
// touch timestamp, lets the screen run silently for layout work.
const PRESENTATION_RATE = 48_000;
const MS_PER_SECOND = 1000;
const NS_PER_MS = 1_000_000;

const presentationFrame = (nowMs: number) =>
  (nowMs * PRESENTATION_RATE) / MS_PER_SECOND;

export const calibrationDeps: typeof Native.calibrationDeps = {
  startClick: () => Promise.resolve(KB_RESULT.KB_OK),
  stopClick: () => undefined,
  isClickActive: () => Promise.resolve(true),
  nowFrame: () => presentationFrame(globalThis.performance.now()),
  readClockPair: () => {
    const now = globalThis.performance.now();
    return {
      frame: presentationFrame(now),
      monotonicNs: now * NS_PER_MS,
      sampleRate: PRESENTATION_RATE,
    };
  },
  getOutputRoute,
  watchOutputRoute: () => () => undefined,
  saveRouteLatency: (entry) => routeLatency.getState().record(entry),
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
} satisfies CalibrationDeps;
