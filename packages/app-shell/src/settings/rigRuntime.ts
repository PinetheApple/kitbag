import {
  getKitbagCommands,
  getKitbagHostObject,
  watchOutputRoute,
} from '@kitbag/core-native';
import {
  configureSubdivisionAccentsPersistence,
  createRouteLatencyStore,
  metronomeStore,
  type RigClickDeps,
} from '@kitbag/core-state';

import { getDatabase } from '@/runtime/database';
import { storedPreference } from '@/runtime/storedPreference';

import {
  accentsPersistence,
  volumePersistence,
  type RigKey,
} from './rigPreferences.ts';
import { startRig } from './rigStart.ts';

const stored = (key: RigKey) =>
  storedPreference(() => getDatabase().preferences, key, 'rig setting');

configureSubdivisionAccentsPersistence(accentsPersistence(stored));

export const routeLatency = createRouteLatencyStore({
  list: () => getDatabase().routeLatency.list(),
  save: (entry) => getDatabase().routeLatency.save(entry),
  remove: (route) => getDatabase().routeLatency.remove(route),
  watchOutputRoute,
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
  appliedLatency: () => metronomeStore.getState().latencyOffset,
});

export const rigClickDeps: RigClickDeps = {
  startClick: (bpm, subdivision, startFrame) =>
    getKitbagCommands().rigClickStart(bpm, subdivision, startFrame),
  stopClick: () => {
    getKitbagCommands().rigClickStop();
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
};

export function setLiveVolume(volume: number): void {
  getKitbagCommands().setVolume(volume);
}

startRig({
  routeLatency,
  volume: volumePersistence(stored),
  sendAccents: (count, slotMask) => {
    getKitbagCommands().setSubdivisionAccents(count, slotMask);
  },
});
