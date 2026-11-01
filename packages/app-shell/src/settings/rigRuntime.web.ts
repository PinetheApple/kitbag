import { KB_RESULT, getOutputRoute } from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';

import {
  storedWebPreference,
  WEB_KEY_PREFIX,
} from '@/runtime/storedWebPreference';

import { presentationFrame } from './presentationClock.ts';
import { applyLatency, bootRig } from './rigBoot.ts';
import type { RigKey } from './rigPreferences.ts';
import type * as Native from './rigRuntime.ts';

export const rigEngineDeps: typeof Native.rigEngineDeps = {
  startClick: () => Promise.resolve(KB_RESULT.KB_OK),
  stopClick: () => undefined,
  nowFrame: () => presentationFrame(globalThis.performance.now()),
  applyLatency,
};

export const setLiveVolume: typeof Native.setLiveVolume = () => undefined;

const routes = new Map<string, RouteLatency>();

export const routeLatency: typeof Native.routeLatency = bootRig({
  stored: (key: RigKey) => storedWebPreference(`${WEB_KEY_PREFIX}${key}`),
  sendAccents: () => undefined,
  routes: {
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
  },
});
