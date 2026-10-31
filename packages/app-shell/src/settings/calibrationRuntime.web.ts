import { getOutputRoute } from '@kitbag/core-native';
import type { CalibrationDeps } from '@kitbag/core-state';

import type * as Native from './calibrationRuntime.ts';
import { PRESENTATION_RATE, presentationFrame } from './presentationClock.ts';
import { rigEngineDeps, routeLatency } from './rigRuntime';

const NS_PER_MS = 1_000_000;

export const calibrationDeps: typeof Native.calibrationDeps = {
  ...rigEngineDeps,
  isClickActive: () => Promise.resolve(true),
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
} satisfies CalibrationDeps;
