import { getKitbagStemDeck } from '@kitbag/core-native';
import {
  configureStemDeck,
  stemDeckStore,
  type StemDeckNative,
} from '@kitbag/core-state';
import { AppState } from 'react-native';

import { cameraPermission } from './cameraPermission.ts';
import { getDatabase } from './database.ts';
import { PREFERENCE_FLAG, storedPreference } from './storedPreference.ts';

const UNITY_NOTICE_KEY = 'stemdeck_unity_notice_seen';
const ACTIVE = 'active';

// Resolved per call: getKitbagStemDeck throws in a build without the module.
const native: StemDeckNative = {
  constants: () => getKitbagStemDeck().getConstants(),
  probe: (origin) => getKitbagStemDeck().probe(origin),
  trust: (origin, fingerprint) =>
    getKitbagStemDeck().trust(origin, fingerprint),
  forget: (origin) => getKitbagStemDeck().forget(origin),
  knownServers: () => getKitbagStemDeck().knownServers(),
  getJson: (origin, endpoint) => getKitbagStemDeck().getJson(origin, endpoint),
  startImport: (origin, items) =>
    getKitbagStemDeck().startImport(origin, items),
  cancelImport: () => {
    getKitbagStemDeck().cancelImport();
  },
  retryImport: () => getKitbagStemDeck().retryImport(),
  importSnapshot: () => getKitbagStemDeck().importSnapshot(),
  settleDownload: (jobId, outcome) => {
    getKitbagStemDeck().settleDownload(jobId, outcome);
  },
  setWatching: (watching) => {
    getKitbagStemDeck().setWatching(watching);
  },
  scanQr: (look) => getKitbagStemDeck().scanQr(look),
  onImport: (listener) => {
    const subscription = getKitbagStemDeck().onImport(listener);
    return () => {
      subscription.remove();
    };
  },
};

const unityNotice = storedPreference(
  () => getDatabase().preferences,
  UNITY_NOTICE_KEY,
  'StemDeck mix notice',
);

configureStemDeck({
  native,
  camera: cameraPermission,
  unityNotice: {
    load: () => unityNotice.read() === PREFERENCE_FLAG.on,
    save: () => {
      unityNotice.write(PREFERENCE_FLAG.on);
    },
  },
});

// A finished download waits for JS to add it, with Kitbag on screen or not, so
// this listens from launch rather than from a screen.
stemDeckStore
  .getState()
  .start()
  .catch((error: unknown) => {
    console.warn('[kitbag] StemDeck import listener not started', error);
  });

stemDeckStore.getState().setWatching(AppState.currentState === ACTIVE);
AppState.addEventListener('change', (state) => {
  stemDeckStore.getState().setWatching(state === ACTIVE);
});
