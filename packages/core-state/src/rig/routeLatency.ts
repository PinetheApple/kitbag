import {
  KB_LATENCY_OFFSET_MS_BOUNDS,
  type OutputRoute,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { clamp } from '../metronome/config.ts';

export const ROUTE_LATENCY_SAVE_DELAY_MS = 600;

export interface RouteLatencyDeps {
  readonly list: () => Promise<readonly RouteLatency[]>;
  readonly save: (entry: RouteLatency) => Promise<void>;
  readonly remove: (route: string) => Promise<void>;
  readonly watchOutputRoute: (
    listener: (route: OutputRoute) => void,
  ) => () => void;
  readonly applyLatency: (offsetMs: number) => void;
  readonly appliedLatency: () => number;
}

export interface RouteLatencyState {
  readonly live: OutputRoute | null;
  readonly stored: Readonly<Record<string, RouteLatency>>;
}

export interface RouteLatencyActions {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly flush: () => void;
  readonly step: (deltaMs: number) => void;
  readonly record: (entry: RouteLatency) => Promise<void>;
  readonly clear: (route: string) => Promise<void>;
}

export type RouteLatencyStore = StoreApi<
  RouteLatencyState & RouteLatencyActions
>;

const clampOffset = (offsetMs: number) =>
  clamp(
    offsetMs,
    KB_LATENCY_OFFSET_MS_BOUNDS.min,
    KB_LATENCY_OFFSET_MS_BOUNDS.max,
  );

const warn = (error: unknown) => {
  console.warn('[kitbag] route latency not stored', error);
};

function without(
  stored: Readonly<Record<string, RouteLatency>>,
  route: string,
): Readonly<Record<string, RouteLatency>> {
  return Object.fromEntries(
    Object.entries(stored).filter(([key]) => key !== route),
  );
}

export function createRouteLatencyStore(
  deps: RouteLatencyDeps,
): RouteLatencyStore {
  return createStore<RouteLatencyState & RouteLatencyActions>((set, get) => {
    let unwatch: (() => void) | null = null;
    let pending: RouteLatency | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancelPending = (route?: string) => {
      if (route !== undefined && pending?.route !== route) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    };

    const flush = () => {
      const entry = pending;
      cancelPending();
      if (entry !== null) deps.save(entry).catch(warn);
    };

    const onRoute = (route: OutputRoute) => {
      const same = get().live?.id === route.id;
      if (pending?.route !== route.id) flush();
      set({ live: route });
      if (!same) deps.applyLatency(get().stored[route.id]?.offsetMs ?? 0);
    };

    return {
      live: null,
      stored: {},

      start: async () => {
        get().stop();
        try {
          const rows = await deps.list();
          set({
            stored: Object.fromEntries(rows.map((row) => [row.route, row])),
          });
        } catch (error) {
          warn(error);
        }
        unwatch = deps.watchOutputRoute(onRoute);
      },

      stop: () => {
        flush();
        unwatch?.();
        unwatch = null;
      },

      flush,

      step: (deltaMs) => {
        const { live, stored } = get();
        const offsetMs = clampOffset(deps.appliedLatency() + deltaMs);
        deps.applyLatency(offsetMs);
        if (live?.certain !== true) return;
        const entry: RouteLatency = {
          route: live.id,
          offsetMs,
          name: live.name,
          kind: live.kind,
        };
        set({ stored: { ...stored, [live.id]: entry } });
        if (timer !== null) clearTimeout(timer);
        pending = entry;
        timer = setTimeout(flush, ROUTE_LATENCY_SAVE_DELAY_MS);
      },

      record: async (entry) => {
        cancelPending(entry.route);
        set({ stored: { ...get().stored, [entry.route]: entry } });
        if (get().live?.id === entry.route) deps.applyLatency(entry.offsetMs);
        await deps.save(entry);
      },

      clear: async (route) => {
        cancelPending(route);
        set({ stored: without(get().stored, route) });
        if (get().live?.id === route) deps.applyLatency(0);
        await deps.remove(route);
      },
    };
  });
}
