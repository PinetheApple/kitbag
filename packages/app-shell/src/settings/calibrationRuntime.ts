import {
  getEngineClockPair,
  getKitbagCommands,
  getOutputRoute,
  watchOutputRoute,
} from '@kitbag/core-native';
import type { CalibrationDeps } from '@kitbag/core-state';

import { rigEngineDeps, routeLatency } from './rigRuntime';

export const calibrationDeps: CalibrationDeps = {
  ...rigEngineDeps,
  isClickActive: () => getKitbagCommands().rigClickIsActive(),
  readClockPair: getEngineClockPair,
  getOutputRoute,
  watchOutputRoute,
  saveRouteLatency: (entry) => routeLatency.getState().record(entry),
};
