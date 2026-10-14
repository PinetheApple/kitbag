import type { TuningRepository } from '@kitbag/core-db';
import { getKitbagCommands } from '@kitbag/core-native';
import {
  configureTunerRuntime,
  configureTunings,
  type AppActivitySource,
  type MicPermissionSource,
  type TunerCommands,
} from '@kitbag/core-state';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { getDatabase } from './database.ts';
import {
  appActivityFromState,
  micPermissionFromRequest,
} from './micPermission.ts';

// Device wiring for the tuner store (#118). Each command resolves the
// TurboModule on call, not at import: getKitbagCommands throws in a build
// without the native module, and this file loads with the root layout.
const commands: TunerCommands = {
  tunerStart: () => getKitbagCommands().tunerStart(),
  tunerStop: () => {
    getKitbagCommands().tunerStop();
  },
  tunerSetTuning: (instrument, notes) =>
    getKitbagCommands().tunerSetTuning(instrument, notes),
  tunerSetTargetString: (index) =>
    getKitbagCommands().tunerSetTargetString(index),
  tunerSetChromatic: () => getKitbagCommands().tunerSetChromatic(),
  tunerSetA4: (hz) => getKitbagCommands().tunerSetA4(hz),
  tunerResetNotePresence: (pauseMs) =>
    getKitbagCommands().tunerResetNotePresence(pauseMs),
};

const RECORD_AUDIO = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;

// Android only: the shipped target. There is no iOS build; on another platform
// this reports granted and leaves any prompt to the OS when capture opens,
// which is untested.
const micPermission: MicPermissionSource = {
  check: async () => {
    if (Platform.OS !== 'android') return 'granted';
    // check() cannot tell a plain denial from never-ask-again; only request()
    // can, and screen entry always requests.
    return (await PermissionsAndroid.check(RECORD_AUDIO))
      ? 'granted'
      : 'denied';
  },
  request: async () => {
    if (Platform.OS !== 'android') return 'granted';
    const answer = await PermissionsAndroid.request(RECORD_AUDIO);
    return micPermissionFromRequest(answer, PermissionsAndroid.RESULTS);
  },
};

const appActivity: AppActivitySource = {
  subscribe: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => {
      const activity = appActivityFromState(state);
      if (activity !== undefined) listener(activity);
    });
    return () => {
      subscription.remove();
    };
  },
};

// Custom tunings share the app's one connection, opened on first use.
const tunings: TuningRepository = {
  list: () => getDatabase().tunings.list(),
  create: (values) => getDatabase().tunings.create(values),
  update: (id, values) => getDatabase().tunings.update(id, values),
  delete: (id) => getDatabase().tunings.delete(id),
};

configureTunerRuntime({ commands, micPermission, appActivity });
configureTunings(tunings);
