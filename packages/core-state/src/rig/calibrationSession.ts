import {
  KB_RESULT,
  renderedFrameToMonotonicMs,
  type EngineClockPair,
  type OutputRoute,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { CALIBRATION } from './calibrationRules.ts';
import {
  analyseTaps,
  storedOffsetMs,
  tapDeviationMs,
  type CalibrationOutcome,
  type ClickSchedule,
} from './calibrationStats.ts';

export interface CalibrationDeps {
  readonly startClick: (
    bpm: number,
    subdivision: number,
    startFrame: number,
  ) => Promise<number>;
  readonly stopClick: () => void;
  readonly isClickActive: () => Promise<boolean>;
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
  | 'idle'
  | 'starting'
  | 'running'
  | 'done'
  | 'busy'
  | 'failed'
  | 'route-failed'
  | 'stopped';

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

export function canUseOutcome(
  state: Pick<CalibrationState, 'phase' | 'outcome' | 'route'>,
): boolean {
  return (
    state.phase === 'done' &&
    state.outcome?.kind === 'measured' &&
    state.route?.certain === true
  );
}

export function engineRestarted(
  previous: EngineClockPair,
  next: EngineClockPair,
): boolean {
  const drift =
    renderedFrameToMonotonicMs(next.frame, next) -
    renderedFrameToMonotonicMs(next.frame, previous);
  return Math.abs(drift) > CALIBRATION.engineJumpMs;
}

export function createCalibrationSession(
  deps: CalibrationDeps,
): StoreApi<CalibrationSession> {
  return createStore<CalibrationSession>((set, get) => {
    let generation = 0;
    let openGeneration: number | null = null;
    let schedule: ClickSchedule | null = null;
    let scheduleRate: number | null = null;
    let lastPair: EngineClockPair | null = null;
    let unwatch: (() => void) | null = null;

    const current = (opened: number) => opened === generation;

    const restartRun = (notice: CalibrationNotice | null) => {
      lastPair = null;
      set({ phase: 'running', deviations: [], outcome: null, notice });
    };

    const onRoute = (route: OutputRoute) => {
      const { phase, route: shown } = get();
      if (phase !== 'running' && phase !== 'done') return;
      set({ route });
      if (shown?.certain === true && shown.id !== route.id) {
        restartRun('route-changed');
      }
    };

    const armClick = async (opened: number) => {
      const startFrame = deps.nowFrame();
      const result = await deps.startClick(
        CALIBRATION.bpm,
        CALIBRATION.subdivision,
        startFrame,
      );
      if (!current(opened)) {
        if (result === KB_RESULT.KB_OK && openGeneration === null) {
          deps.stopClick();
        }
        return false;
      }
      if (result !== KB_RESULT.KB_OK) {
        set({ phase: result === KB_RESULT.KB_ERROR_BUSY ? 'busy' : 'failed' });
        return false;
      }
      schedule = { startFrame, bpm: CALIBRATION.bpm };
      scheduleRate = deps.readClockPair()?.sampleRate ?? null;
      return true;
    };

    const rearm = (opened: number) => {
      schedule = null;
      restartRun('engine-restarted');
      armClick(opened).catch(() => {
        if (current(opened)) set({ phase: 'failed' });
      });
    };

    const confirmClickRunning = (opened: number) => {
      deps.isClickActive().then(
        (active) => {
          if (!active && current(opened) && get().phase === 'running') {
            schedule = null;
            set({ phase: 'stopped' });
          }
        },
        () => undefined,
      );
    };

    const finishRun = (opened: number, deviations: readonly number[]) => {
      const settle = (active: boolean) => {
        if (!current(opened) || get().deviations !== deviations) return;
        if (!active) {
          schedule = null;
          set({ phase: 'stopped' });
          return;
        }
        set({ phase: 'done', outcome: analyseTaps(deviations) });
      };
      deps.isClickActive().then(settle, () => {
        settle(true);
      });
    };

    const readRoute = async (opened: number, clickArmed: boolean) => {
      try {
        return await deps.getOutputRoute();
      } catch {
        if (current(opened)) {
          if (clickArmed) deps.stopClick();
          set({ phase: 'route-failed' });
        }
        return null;
      }
    };

    const stop = () => {
      generation += 1;
      unwatch?.();
      unwatch = null;
      schedule = null;
      lastPair = null;
    };

    const openSession = async (opened: number) => {
      let route = await readRoute(opened, false);
      if (route === null || !current(opened)) return;
      if (!(await armClick(opened))) return;
      if (!route.certain) {
        route = await readRoute(opened, true);
        if (route === null || !current(opened)) return;
      }
      set({ phase: 'running', route });
      unwatch = deps.watchOutputRoute(onRoute);
    };

    return {
      ...IDLE,

      open: async () => {
        stop();
        const opened = generation;
        openGeneration = opened;
        set({ ...IDLE, phase: 'starting' });
        try {
          await openSession(opened);
        } catch {
          if (current(opened)) set({ phase: 'failed' });
        }
      },

      close: () => {
        stop();
        openGeneration = null;
        deps.stopClick();
        set(IDLE);
      },

      tap: (timestampMs) => {
        const { phase, deviations: taken } = get();
        if (phase !== 'running' || schedule === null) return;
        if (taken.length >= CALIBRATION.taps) return;
        const pair = deps.readClockPair();
        if (pair === null) return;
        const opened = generation;
        scheduleRate ??= pair.sampleRate;
        if (pair.sampleRate !== scheduleRate) {
          rearm(opened);
          return;
        }
        if (lastPair !== null && engineRestarted(lastPair, pair)) {
          restartRun('engine-restarted');
          return;
        }
        lastPair = pair;
        const deviations = [
          ...taken,
          tapDeviationMs(timestampMs, pair, schedule),
        ];
        set({ deviations, notice: null });
        if (deviations.length < CALIBRATION.taps) {
          confirmClickRunning(opened);
          return;
        }
        finishRun(opened, deviations);
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
        const state = get();
        const { outcome, route } = state;
        if (!canUseOutcome(state) || outcome?.kind !== 'measured') {
          return false;
        }
        if (route === null) return false;
        const offsetMs = storedOffsetMs(outcome.meanMs);
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
