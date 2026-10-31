import { KB_RESULT, getOutputRoute } from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import {
  configureSubdivisionAccentsPersistence,
  createRouteLatencyStore,
  metronomeStore,
} from '@kitbag/core-state';

import { storedWebPreference } from '@/runtime/storedWebPreference';

import type * as Native from './rigRuntime.ts';
import {
  accentsPersistence,
  volumePersistence,
  type RigKey,
} from './rigPreferences.ts';
import { startRig } from './rigStart.ts';

const WEB_KEY_PREFIX = 'kitbag.';

const stored = (key: RigKey) => storedWebPreference(`${WEB_KEY_PREFIX}${key}`);

configureSubdivisionAccentsPersistence(accentsPersistence(stored));

const routes = new Map<string, RouteLatency>();

export const routeLatency: typeof Native.routeLatency = createRouteLatencyStore(
  {
    list: () => Promise.resolve([...routes.values()]),
    save: (entry) => {
      routes.set(entry.route, entry);
      return Promise.resolve();
    },
    remove: (route) => {
      routes.delete(route);
      return Promise.resolve();
    },
    watchOutputRoute: (listener) => {
      void getOutputRoute().then(listener);
      return () => undefined;
    },
    applyLatency: (offsetMs) => {
      metronomeStore.getState().setLatency(offsetMs);
    },
    appliedLatency: () => metronomeStore.getState().latencyOffset,
  },
);

export const rigClickDeps: typeof Native.rigClickDeps = {
  startClick: () => Promise.resolve(KB_RESULT.KB_OK),
  stopClick: () => undefined,
  nowFrame: () => 0,
};

export const setLiveVolume: typeof Native.setLiveVolume = () => undefined;

startRig({
  routeLatency,
  volume: volumePersistence(stored),
  sendAccents: () => undefined,
});
