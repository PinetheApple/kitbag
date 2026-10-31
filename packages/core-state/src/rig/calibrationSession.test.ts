import {
  KB_RESULT,
  type EngineClockPair,
  type OutputRoute,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { CALIBRATION } from './calibrationRules.ts';
import {
  canUseOutcome,
  createCalibrationSession,
  type CalibrationDeps,
} from './calibrationSession.ts';

const RATE = 48_000;
const MS_PER_BEAT = 60_000 / CALIBRATION.bpm;
const START_FRAME = 48_000;
const START_MS = 1_000;

const SPEAKER: OutputRoute = {
  id: 'speaker',
  name: '',
  kind: 'speaker',
  certain: true,
};
const HEADPHONES: OutputRoute = {
  id: 'bt-a2dp:headphones',
  name: 'WH-1000XM4',
  kind: 'bluetooth',
  certain: true,
};

function pairAt(ms: number, gapMs = 0, rate = RATE): EngineClockPair {
  return {
    frame: START_FRAME + ((ms - START_MS - gapMs) * rate) / 1000,
    monotonicNs: ms * 1_000_000,
    sampleRate: rate,
  };
}

interface Deferred {
  readonly promise: Promise<number>;
  readonly resolve: (result: number) => void;
}

function deferred(): Deferred {
  let resolve: (result: number) => void = () => undefined;
  const promise = new Promise<number>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

interface HarnessOptions {
  readonly routes?: readonly OutputRoute[];
  readonly clickResult?: number;
  readonly routeError?: boolean;
}

function harness({
  routes = [HEADPHONES],
  clickResult = KB_RESULT.KB_OK,
  routeError = false,
}: HarnessOptions = {}) {
  const calls = {
    starts: [] as number[][],
    stops: 0,
    saved: [] as RouteLatency[],
    applied: [] as number[],
  };
  let routeListener: ((route: OutputRoute) => void) | undefined;
  let pair: EngineClockPair | null = pairAt(START_MS);
  let clickActive = true;
  const pendingStarts: Deferred[] = [];
  let deferStarts = false;
  const queue = [...routes];
  const deps: CalibrationDeps = {
    startClick: (bpm, subdivision, startFrame) => {
      calls.starts.push([bpm, subdivision, startFrame]);
      if (!deferStarts) return Promise.resolve(clickResult);
      const start = deferred();
      pendingStarts.push(start);
      return start.promise;
    },
    stopClick: () => {
      calls.stops += 1;
    },
    isClickActive: () => Promise.resolve(clickActive),
    nowFrame: () => START_FRAME,
    readClockPair: () => pair,
    getOutputRoute: () => {
      if (routeError) return Promise.reject(new Error('no route'));
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return next === undefined
        ? Promise.reject(new Error('no route'))
        : Promise.resolve(next);
    },
    watchOutputRoute: (listener) => {
      routeListener = listener;
      return () => {
        routeListener = undefined;
      };
    },
    saveRouteLatency: (entry) => {
      calls.saved.push(entry);
      return Promise.resolve();
    },
    applyLatency: (offsetMs) => {
      calls.applied.push(offsetMs);
    },
  };
  const session = createCalibrationSession(deps);
  const tapAt = (beat: number, lateMs: number, gapMs = 0, rate = RATE) => {
    const ms = START_MS + beat * MS_PER_BEAT + lateMs;
    pair = pairAt(ms - 3, gapMs, rate);
    session.getState().tap(ms);
  };
  const tapRun = (lateMs: number, count: number = CALIBRATION.taps) => {
    for (let i = 1; i <= count; i += 1)
      tapAt(i, lateMs + (i % 2 === 0 ? -1 : 1));
  };
  return {
    session,
    calls,
    tapAt,
    tapRun,
    pendingStarts,
    deferStarts: () => {
      deferStarts = true;
    },
    setPair: (next: EngineClockPair | null) => {
      pair = next;
    },
    stopClickExternally: () => {
      clickActive = false;
    },
    emitRoute: (route: OutputRoute) => routeListener?.(route),
  };
}

describe('calibration session', () => {
  it('starts a 100 BPM click at the current frame for the live route', async () => {
    const { session, calls } = harness();
    await session.getState().open();
    expect(calls.starts).toEqual([
      [CALIBRATION.bpm, CALIBRATION.subdivision, START_FRAME],
    ]);
    expect(session.getState()).toMatchObject({
      phase: 'running',
      route: HEADPHONES,
    });
  });

  it('counts each tap and finishes after 16', async () => {
    const { session, tapRun } = harness();
    await session.getState().open();
    tapRun(12, CALIBRATION.taps - 1);
    expect(session.getState().deviations).toHaveLength(CALIBRATION.taps - 1);
    expect(session.getState().phase).toBe('running');
    tapRun(12, 1);
    expect(session.getState().phase).toBe('done');
    expect(session.getState().outcome).toMatchObject({
      kind: 'measured',
      steady: true,
    });
  });

  it('skips a tap with no clock pair', async () => {
    const { session, setPair } = harness();
    await session.getState().open();
    setPair(null);
    session.getState().tap(START_MS + MS_PER_BEAT);
    expect(session.getState().deviations).toEqual([]);
  });

  it('restarts the run when the engine restarted mid-run, and says so', async () => {
    const { session, tapAt } = harness();
    await session.getState().open();
    tapAt(1, 10);
    tapAt(2, 10);
    tapAt(3, 10, 400);
    expect(session.getState()).toMatchObject({
      deviations: [],
      notice: 'engine-restarted',
    });
  });

  it('re-arms the click when the sample rate changes', async () => {
    const { session, calls, tapAt } = harness();
    await session.getState().open();
    tapAt(1, 10);
    tapAt(2, 10, 0, RATE / 2);
    await flush();
    expect(calls.starts).toHaveLength(2);
    expect(session.getState()).toMatchObject({
      phase: 'running',
      deviations: [],
      notice: 'engine-restarted',
    });
  });

  it('ends the run when the click stopped under it', async () => {
    const { session, tapAt, stopClickExternally } = harness();
    await session.getState().open();
    stopClickExternally();
    tapAt(1, 10);
    await flush();
    expect(session.getState().phase).toBe('stopped');
    tapAt(2, 10);
    expect(session.getState().deviations).toHaveLength(1);
  });

  it('restarts the run when the route changes mid-run, and says so', async () => {
    const { session, tapAt, emitRoute } = harness();
    await session.getState().open();
    tapAt(1, 10);
    emitRoute(SPEAKER);
    expect(session.getState()).toMatchObject({
      deviations: [],
      notice: 'route-changed',
      route: SPEAKER,
    });
  });

  it('keeps the run when the same route is reported again', async () => {
    const { session, tapAt, emitRoute } = harness();
    await session.getState().open();
    tapAt(1, 10);
    emitRoute(HEADPHONES);
    expect(session.getState().deviations).toHaveLength(1);
  });

  it('re-reads an uncertain route once the click runs', async () => {
    const guess = { ...SPEAKER, certain: false };
    const { session } = harness({ routes: [guess, HEADPHONES] });
    await session.getState().open();
    expect(session.getState().route).toEqual(HEADPHONES);
  });

  it('treats a guess replaced by a confirmed route as confirmation, not a change', async () => {
    const guess = { ...SPEAKER, certain: false };
    const { session, tapAt, emitRoute } = harness({ routes: [guess] });
    await session.getState().open();
    tapAt(1, 10);
    emitRoute(HEADPHONES);
    expect(session.getState()).toMatchObject({
      route: HEADPHONES,
      notice: null,
    });
    expect(session.getState().deviations).toHaveLength(1);
  });

  it('never stores against a route that stays uncertain', async () => {
    const guess = { ...SPEAKER, certain: false };
    const { session, calls, tapRun } = harness({ routes: [guess] });
    await session.getState().open();
    tapRun(12);
    expect(canUseOutcome(session.getState())).toBe(false);
    await session.getState().use();
    expect(calls.saved).toEqual([]);
    expect(calls.applied).toEqual([]);
  });

  it('stores the rounded mean against the live route and applies it', async () => {
    const { session, calls, tapRun } = harness();
    await session.getState().open();
    tapRun(12.4);
    await session.getState().use();
    expect(calls.saved).toEqual([
      {
        route: HEADPHONES.id,
        offsetMs: 12,
        name: HEADPHONES.name,
        kind: HEADPHONES.kind,
      },
    ]);
    expect(calls.applied).toEqual([12]);
  });

  it('stores nothing when it refused to produce a number', async () => {
    const { session, calls, tapAt } = harness();
    await session.getState().open();
    const wild = CALIBRATION.usableWindowMs + 30;
    for (let i = 1; i <= CALIBRATION.taps; i += 1)
      tapAt(i, i % 2 === 0 ? wild : -wild);
    expect(session.getState().outcome).toMatchObject({ kind: 'refused' });
    await session.getState().use();
    expect(calls.saved).toEqual([]);
  });

  it('starts over with an empty run on the same click', async () => {
    const { session, calls, tapRun } = harness();
    await session.getState().open();
    tapRun(12);
    session.getState().startOver();
    expect(session.getState()).toMatchObject({
      phase: 'running',
      deviations: [],
      outcome: null,
    });
    expect(calls.starts).toHaveLength(1);
  });

  it('reports a busy engine instead of running', async () => {
    const { session } = harness({ clickResult: KB_RESULT.KB_ERROR_BUSY });
    await session.getState().open();
    expect(session.getState().phase).toBe('busy');
  });

  it('fails when the output route cannot be read', async () => {
    const { session, calls } = harness({ routeError: true });
    await session.getState().open();
    expect(session.getState().phase).toBe('failed');
    expect(calls.starts).toEqual([]);
  });

  it('stops the click on close and ignores taps after it', async () => {
    const { session, calls } = harness();
    await session.getState().open();
    session.getState().close();
    session.getState().tap(START_MS + MS_PER_BEAT);
    expect(calls.stops).toBe(1);
    expect(session.getState()).toMatchObject({ phase: 'idle', deviations: [] });
  });

  it('stops a click whose start resolves after close', async () => {
    const h = harness();
    h.deferStarts();
    const opening = h.session.getState().open();
    await flush();
    h.session.getState().close();
    h.pendingStarts[0]?.resolve(KB_RESULT.KB_OK);
    await opening;
    expect(h.calls.stops).toBe(2);
    expect(h.session.getState().phase).toBe('idle');
  });

  it('leaves a newer open’s click running when a stale start resolves', async () => {
    const h = harness();
    h.deferStarts();
    const stale = h.session.getState().open();
    await flush();
    h.session.getState().close();
    const fresh = h.session.getState().open();
    await flush();
    h.pendingStarts[1]?.resolve(KB_RESULT.KB_OK);
    await fresh;
    h.pendingStarts[0]?.resolve(KB_RESULT.KB_OK);
    await stale;
    expect(h.calls.stops).toBe(1);
    expect(h.session.getState().phase).toBe('running');
  });
});
