import { getKitbagCommands } from '@kitbag/core-native';
import { BPM_BOUNDS, metronomeStore } from '@kitbag/core-state';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  notificationStepAfterAppChange,
  shownAfterNativeChange,
  storePatchFor,
  transportActive,
  type TransportShown,
} from './transportSync';

const POST_NOTIFICATIONS_RUNTIME_SDK = 33;

let shown: TransportShown | undefined;
let applyingNative = false;
let askedForNotifications = false;

function askForNotificationsOnce() {
  if (askedForNotifications || Platform.OS !== 'android') return;
  askedForNotifications = true;
  if (Platform.Version < POST_NOTIFICATIONS_RUNTIME_SDK) return;
  void PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

// Reads the latest state: a nested setState can hand later listeners an older snapshot.
metronomeStore.subscribe(() => {
  if (applyingNative) return;
  const step = notificationStepAfterAppChange(
    metronomeStore.getState(),
    shown,
    Date.now(),
  );
  if (step.kind === 'show') {
    askForNotificationsOnce();
    shown = step.shown;
    getKitbagCommands().transportShow({
      ...shown,
      minBpm: BPM_BOUNDS.min,
      maxBpm: BPM_BOUNDS.max,
    });
  } else if (step.kind === 'hide') {
    shown = undefined;
    getKitbagCommands().transportHide();
  }
});

getKitbagCommands().onTransport((event) => {
  shown = shownAfterNativeChange(shown, event);
  applyingNative = true;
  try {
    metronomeStore.setState(storePatchFor(event, metronomeStore.getState()));
  } finally {
    applyingNative = false;
  }
});

export const metronomeTransport = {
  active: () => transportActive(metronomeStore.getState().running, shown),
  release: () => {
    metronomeStore.getState().stop();
    if (shown === undefined) return;
    shown = undefined;
    getKitbagCommands().transportHide();
  },
};
