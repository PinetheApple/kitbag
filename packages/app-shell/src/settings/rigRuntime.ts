import {
  getKitbagCommands,
  getKitbagHostObject,
  watchOutputRoute,
} from '@kitbag/core-native';
import { metronomeStore, type CalibrationDeps } from '@kitbag/core-state';

import { getDatabase } from '@/runtime/database';
import { storedPreference } from '@/runtime/storedPreference';

import { applyLatency, bootRig } from './rigBoot.ts';
import { volumePersistence, type RigKey } from './rigPreferences.ts';
import { reloadRig } from './rigStart.ts';

export type RigEngineDeps = Pick<
  CalibrationDeps,
  'startClick' | 'stopClick' | 'nowFrame' | 'applyLatency'
>;

export const rigEngineDeps: RigEngineDeps = {
  startClick: (bpm, subdivision, startFrame) =>
    getKitbagCommands().rigClickStart(bpm, subdivision, startFrame),
  stopClick: () => {
    getKitbagCommands().rigClickStop();
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
  applyLatency,
};

export function setLiveVolume(volume: number): void {
  getKitbagCommands().setVolume(volume);
}

const stored = (key: RigKey) =>
  storedPreference(() => getDatabase().preferences, key, 'rig setting');

export const routeLatency = bootRig({
  stored,
  sendAccents: (count, slotMask) => {
    getKitbagCommands().setSubdivisionAccents(count, slotMask);
  },
  routes: {
    list: () => getDatabase().routeLatency.list(),
    save: (entry) => getDatabase().routeLatency.save(entry),
    remove: (route) => getDatabase().routeLatency.remove(route),
    watchOutputRoute,
  },
});

export function reloadRigSettings(): Promise<void> {
  return reloadRig({
    routeLatency,
    metronome: metronomeStore,
    volume: volumePersistence(stored),
  });
}
