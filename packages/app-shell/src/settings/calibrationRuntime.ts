import {
  getEngineClockPair,
  getKitbagCommands,
  getKitbagHostObject,
  getOutputRoute,
  watchOutputRoute,
} from '@kitbag/core-native';
import { metronomeStore, type CalibrationDeps } from '@kitbag/core-state';

import { getDatabase } from '@/runtime/database';

export const calibrationDeps: CalibrationDeps = {
  startClick: (bpm, subdivision, startFrame) =>
    getKitbagCommands().rigClickStart(bpm, subdivision, startFrame),
  stopClick: () => {
    getKitbagCommands().rigClickStop();
  },
  nowFrame: () => getKitbagHostObject().frames_rendered,
  readClockPair: getEngineClockPair,
  getOutputRoute,
  watchOutputRoute,
  saveRouteLatency: (entry) => getDatabase().routeLatency.save(entry),
  applyLatency: (offsetMs) => {
    metronomeStore.getState().setLatency(offsetMs);
  },
};
