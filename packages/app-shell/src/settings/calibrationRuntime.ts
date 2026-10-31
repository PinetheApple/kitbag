import {
  getEngineClockPair,
  getKitbagCommands,
  getKitbagHostObject,
  getOutputRoute,
  watchOutputRoute,
} from '@kitbag/core-native';
import { metronomeStore, type CalibrationDeps } from '@kitbag/core-state';

import { routeLatency } from './rigRuntime';

export const calibrationDeps: CalibrationDeps = {
  startClick: (bpm, subdivision, startFrame) =>
    getKitbagCommands().rigClickStart(bpm, subdivision, startFrame),
  stopClick: () => {
    getKitbagCommands().rigClickStop();
  },
  isClickActive: () => getKitbagCommands().rigClickIsActive(),
  nowFrame: () => getKitbagHostObject().frames_rendered,
  readClockPair: getEngineClockPair,
  getOutputRoute,
  watchOutputRoute,
  saveRouteLatency: (entry) => routeLatency.getState().record(entry),
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
};
