import {
  getKitbagCommands,
  getKitbagHostObject,
  watchOutputRoute,
} from '@kitbag/core-native';
import {
  configureSubdivisionAccentsPersistence,
  createRouteLatencyStore,
  metronomeStore,
  type CalibrationDeps,
} from '@kitbag/core-state';
import { AppState } from 'react-native';

import { getDatabase } from '@/runtime/database';
import { storedPreference } from '@/runtime/storedPreference';

import {
  accentsPersistence,
  volumePersistence,
  type RigKey,
} from './rigPreferences.ts';
import { startRig } from './rigStart.ts';

export type RigEngineDeps = Pick<
  CalibrationDeps,
  'startClick' | 'stopClick' | 'nowFrame' | 'applyLatency'
>;

const stored = (key: RigKey) =>
  storedPreference(() => getDatabase().preferences, key, 'rig setting');

configureSubdivisionAccentsPersistence(accentsPersistence(stored));

export const rigEngineDeps: RigEngineDeps = {
  startClick: (bpm, subdivision, startFrame) =>
    getKitbagCommands().rigClickStart(bpm, subdivision, startFrame),
  stopClick: () => {
    getKitbagCommands().rigClickStop();
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
};

export const routeLatency = createRouteLatencyStore({
  list: () => getDatabase().routeLatency.list(),
  save: (entry) => getDatabase().routeLatency.save(entry),
  remove: (route) => getDatabase().routeLatency.remove(route),
  watchOutputRoute,
  applyLatency: rigEngineDeps.applyLatency,
  appliedLatency: () => metronomeStore.getState().latencyOffset,
});

export function setLiveVolume(volume: number): void {
  getKitbagCommands().setVolume(volume);
}

startRig({
  routeLatency,
  metronome: metronomeStore,
  volume: volumePersistence(stored),
  sendAccents: (count, slotMask) => {
    getKitbagCommands().setSubdivisionAccents(count, slotMask);
  },
  appState: AppState,
});
