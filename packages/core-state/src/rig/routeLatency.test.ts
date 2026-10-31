import {
  KB_LATENCY_OFFSET_MS_BOUNDS,
  type OutputRoute,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRouteLatencyStore,
  ROUTE_LATENCY_SAVE_DELAY_MS,
  type RouteLatencyDeps,
} from './routeLatency.ts';

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
const GUESSED: OutputRoute = { ...HEADPHONES, certain: false };

const HEADPHONES_ROW: RouteLatency = {
  route: HEADPHONES.id,
  offsetMs: 182,
  name: HEADPHONES.name,
  kind: HEADPHONES.kind,
};

function harness(rows: readonly RouteLatency[] = [HEADPHONES_ROW]) {
  let applied = 0;
  let listener: ((route: OutputRoute) => void) | undefined;
  const calls = {
    applied: [] as number[],
    saved: [] as RouteLatency[],
    removed: [] as string[],
    unwatched: 0,
  };
  const deps: RouteLatencyDeps = {
    list: () => Promise.resolve(rows),
    save: (entry) => {
      calls.saved.push(entry);
      return Promise.resolve();
    },
    remove: (route) => {
      calls.removed.push(route);
      return Promise.resolve();
    },
    watchOutputRoute: (next) => {
      listener = next;
      return () => {
        calls.unwatched += 1;
      };
    },
    applyLatency: (offsetMs) => {
      applied = offsetMs;
      calls.applied.push(offsetMs);
    },
    appliedLatency: () => applied,
  };
  const store = createRouteLatencyStore(deps);
  return {
    store,
    calls,
    route: (route: OutputRoute) => {
      listener?.(route);
    },
    applied: () => applied,
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('route latency', () => {
  it('applies the stored offset of the route in use at start', async () => {
    const { store, route, applied } = harness();
    await store.getState().start();
    route(HEADPHONES);
    expect(applied()).toBe(182);
    expect(store.getState().live).toEqual(HEADPHONES);
  });

  it('applies 0 to a route never calibrated', async () => {
    const { store, route, calls } = harness();
    await store.getState().start();
    route(HEADPHONES);
    route(SPEAKER);
    expect(calls.applied).toEqual([182, 0]);
    expect(store.getState().stored[SPEAKER.id]).toBeUndefined();
  });

  it('switches the offset when the output changes', async () => {
    const { store, route, applied } = harness();
    await store.getState().start();
    route(SPEAKER);
    route(HEADPHONES);
    expect(applied()).toBe(182);
  });

  it('writes stepped offsets once the taps settle, not per tap', async () => {
    const { store, route, calls, applied } = harness();
    await store.getState().start();
    route(HEADPHONES);
    store.getState().step(1);
    store.getState().step(1);
    store.getState().step(1);
    expect(applied()).toBe(185);
    expect(calls.saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(ROUTE_LATENCY_SAVE_DELAY_MS);
    expect(calls.saved).toEqual([{ ...HEADPHONES_ROW, offsetMs: 185 }]);
    expect(store.getState().stored[HEADPHONES.id]?.offsetMs).toBe(185);
  });

  it('clamps the stepped offset to the engine bounds', async () => {
    const { store, route, applied } = harness([
      { ...HEADPHONES_ROW, offsetMs: KB_LATENCY_OFFSET_MS_BOUNDS.max },
    ]);
    await store.getState().start();
    route(HEADPHONES);
    store.getState().step(1);
    expect(applied()).toBe(KB_LATENCY_OFFSET_MS_BOUNDS.max);
  });

  it('stores a first step on a route never calibrated', async () => {
    const { store, route, calls } = harness([]);
    await store.getState().start();
    route(SPEAKER);
    store.getState().step(-1);
    await vi.advanceTimersByTimeAsync(ROUTE_LATENCY_SAVE_DELAY_MS);
    expect(calls.saved).toEqual([
      { route: SPEAKER.id, offsetMs: -1, name: '', kind: 'speaker' },
    ]);
  });

  it('applies a guessed route’s offset but never writes to it', async () => {
    const { store, route, calls, applied } = harness();
    await store.getState().start();
    route(GUESSED);
    expect(applied()).toBe(182);
    store.getState().step(1);
    expect(applied()).toBe(183);
    await vi.advanceTimersByTimeAsync(ROUTE_LATENCY_SAVE_DELAY_MS);
    expect(calls.saved).toEqual([]);
    expect(store.getState().stored[HEADPHONES.id]?.offsetMs).toBe(182);
  });

  it('writes a pending step to its own route when the output changes', async () => {
    const { store, route, calls, applied } = harness();
    await store.getState().start();
    route(HEADPHONES);
    store.getState().step(1);
    route(SPEAKER);
    await flush();
    expect(calls.saved).toEqual([{ ...HEADPHONES_ROW, offsetMs: 183 }]);
    expect(applied()).toBe(0);
    await vi.advanceTimersByTimeAsync(ROUTE_LATENCY_SAVE_DELAY_MS);
    expect(calls.saved).toHaveLength(1);
  });

  it('shows a calibration straight away and applies it to the live route', async () => {
    const { store, route, calls, applied } = harness([]);
    await store.getState().start();
    route(HEADPHONES);
    await store.getState().record(HEADPHONES_ROW);
    expect(store.getState().stored[HEADPHONES.id]).toEqual(HEADPHONES_ROW);
    expect(calls.saved).toEqual([HEADPHONES_ROW]);
    expect(applied()).toBe(182);
  });

  it('clears a route back to never calibrated', async () => {
    const { store, route, calls, applied } = harness();
    await store.getState().start();
    route(HEADPHONES);
    await store.getState().clear(HEADPHONES.id);
    expect(calls.removed).toEqual([HEADPHONES.id]);
    expect(store.getState().stored[HEADPHONES.id]).toBeUndefined();
    expect(applied()).toBe(0);
  });

  it('clears a route not in use without touching the live offset', async () => {
    const { store, route, applied } = harness();
    await store.getState().start();
    route(SPEAKER);
    store.getState().step(5);
    await store.getState().clear(HEADPHONES.id);
    expect(applied()).toBe(5);
  });

  it('writes a pending step and stops watching when stopped', async () => {
    const { store, route, calls } = harness();
    await store.getState().start();
    route(HEADPHONES);
    store.getState().step(1);
    store.getState().stop();
    await flush();
    expect(calls.saved).toHaveLength(1);
    expect(calls.unwatched).toBe(1);
  });

  it('ignores steps before any route is known', async () => {
    const { store, calls } = harness();
    await store.getState().start();
    store.getState().step(1);
    expect(calls.applied).toEqual([]);
  });
});
