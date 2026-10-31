import {
  KB_RESULT,
  type EngineClockPair,
  type OutputRoute,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { CALIBRATION } from './calibrationRules.ts';
import {
  analyseTaps,
  appliedOffset,
  tapDeviationMs,
  type CalibrationOutcome,
  type ClickSchedule,
} from './calibrationStats.ts';

const MS_PER_SECOND = 1000;
const NS_PER_MS = 1_000_000;

export interface CalibrationDeps {
  readonly startClick: (
    bpm: number,
    subdivision: number,
    startFrame: number,
  ) => Promise<number>;
  readonly stopClick: () => void;
  readonly nowFrame: () => number;
  readonly readClockPair: () => EngineClockPair | null;
  readonly getOutputRoute: () => Promise<OutputRoute>;
  readonly watchOutputRoute: (
    listener: (route: OutputRoute) => void,
  ) => () => void;
  readonly saveRouteLatency: (entry: RouteLatency) => Promise<void>;
  readonly applyLatency: (offsetMs: number) => void;
}

export type CalibrationPhase =
  'idle' | 'starting' | 'running' | 'done' | 'busy' | 'failed';

export type CalibrationNotice = 'route-changed' | 'engine-restarted';

export interface CalibrationState {
  readonly phase: CalibrationPhase;
  readonly route: OutputRoute | null;
  readonly deviations: readonly number[];
  readonly outcome: CalibrationOutcome | null;
  readonly notice: CalibrationNotice | null;
}

export interface CalibrationActions {
  readonly open: () => Promise<void>;
  readonly close: () => void;
  readonly tap: (timestampMs: number) => void;
  readonly startOver: () => void;
  readonly use: () => Promise<boolean>;
}

export type CalibrationSession = CalibrationState & CalibrationActions;

const IDLE: CalibrationState = {
  phase: 'idle',
  route: null,
  deviations: [],
  outcome: null,
  notice: null,
};

export function engineRestarted(
  previous: EngineClockPair,
  next: EngineClockPair,
): boolean {
  if (previous.sampleRate !== next.sampleRate) return true;
  const renderedMs =
    ((next.frame - previous.frame) * MS_PER_SECOND) / next.sampleRate;
  const elapsedMs = (next.monotonicNs - previous.monotonicNs) / NS_PER_MS;
  return Math.abs(renderedMs - elapsedMs) > CALIBRATION.engineJumpMs;
}

export function createCalibrationSession(
  deps: CalibrationDeps,
): StoreApi<CalibrationSession> {
  return createStore<CalibrationSession>((set, get) => {
    let generation = 0;
    let schedule: ClickSchedule | null = null;
    let lastPair: EngineClockPair | null = null;
    let unwatch: (() => void) | null = null;

    const restartRun = (notice: CalibrationNotice | null) => {
      lastPair = null;
      set({ phase: 'running', deviations: [], outcome: null, notice });
    };

    const onRoute = (route: OutputRoute) => {
      const { phase, route: current } = get();
      if (phase !== 'running' && phase !== 'done') return;
      set({ route });
      if (current !== null && current.id !== route.id) {
        restartRun('route-changed');
      }
    };

    const stop = () => {
      generation += 1;
      unwatch?.();
      unwatch = null;
      schedule = null;
      lastPair = null;
    };

    return {
      ...IDLE,

      open: async () => {
        stop();
        const opened = generation;
        set({ ...IDLE, phase: 'starting' });
        let route = await deps.getOutputRoute();
        if (opened !== generation) return;
        const startFrame = deps.nowFrame();
        const result = await deps.startClick(
          CALIBRATION.bpm,
          CALIBRATION.subdivision,
          startFrame,
        );
        if (opened !== generation) {
          if (result === KB_RESULT.KB_OK) deps.stopClick();
          return;
        }
        if (result !== KB_RESULT.KB_OK) {
          set({
            phase: result === KB_RESULT.KB_ERROR_BUSY ? 'busy' : 'failed',
          });
          return;
        }
        if (!route.certain) {
          route = await deps.getOutputRoute();
          if (opened !== generation) return;
        }
        schedule = { startFrame, bpm: CALIBRATION.bpm };
        set({ phase: 'running', route });
        unwatch = deps.watchOutputRoute(onRoute);
      },

      close: () => {
        stop();
        deps.stopClick();
        set(IDLE);
      },

      tap: (timestampMs) => {
        if (get().phase !== 'running' || schedule === null) return;
        const pair = deps.readClockPair();
        if (pair === null) return;
        if (lastPair !== null && engineRestarted(lastPair, pair)) {
          restartRun('engine-restarted');
          return;
        }
        lastPair = pair;
        const deviations = [
          ...get().deviations,
          tapDeviationMs(timestampMs, pair, schedule),
        ];
        if (deviations.length < CALIBRATION.taps) {
          set({ deviations, notice: null });
          return;
        }
        set({
          deviations,
          notice: null,
          phase: 'done',
          outcome: analyseTaps(deviations),
        });
      },

      startOver: () => {
        const { phase } = get();
        if (phase === 'running' || phase === 'done') {
          restartRun(null);
          return;
        }
        void get().open();
      },

      use: async () => {
        const { outcome, route } = get();
        if (outcome?.kind !== 'measured' || route?.certain !== true) {
          return false;
        }
        const { offsetMs } = appliedOffset(outcome.meanMs);
        await deps.saveRouteLatency({
          route: route.id,
          offsetMs,
          name: route.name,
          kind: route.kind,
        });
        if (get().route?.id === route.id) deps.applyLatency(offsetMs);
        return true;
      },
    };
  });
}
