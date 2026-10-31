import { KB_RESULT, getOutputRoute } from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import {
  configureSubdivisionAccentsPersistence,
  createRouteLatencyStore,
  metronomeStore,
} from '@kitbag/core-state';
import { AppState } from 'react-native';

import {
  storedWebPreference,
  WEB_KEY_PREFIX,
} from '@/runtime/storedWebPreference';

import { presentationFrame } from './presentationClock.ts';
import type * as Native from './rigRuntime.ts';
import {
  accentsPersistence,
  volumePersistence,
  type RigKey,
} from './rigPreferences.ts';
import { startRig } from './rigStart.ts';

const stored = (key: RigKey) => storedWebPreference(`${WEB_KEY_PREFIX}${key}`);

configureSubdivisionAccentsPersistence(accentsPersistence(stored));

export const rigEngineDeps: typeof Native.rigEngineDeps = {
  startClick: () => Promise.resolve(KB_RESULT.KB_OK),
  stopClick: () => undefined,
  nowFrame: () => presentationFrame(globalThis.performance.now()),
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
};

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
    applyLatency: rigEngineDeps.applyLatency,
    appliedLatency: () => metronomeStore.getState().latencyOffset,
  },
);

export const setLiveVolume: typeof Native.setLiveVolume = () => undefined;

startRig({
  routeLatency,
  metronome: metronomeStore,
  volume: volumePersistence(stored),
  sendAccents: () => undefined,
  appState: AppState,
});
