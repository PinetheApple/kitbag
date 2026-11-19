import { getKitbagCommands } from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  libraryStore,
  metronomeStore,
  transportSetlistOf,
} from '@kitbag/core-state';
import { transportSubtitle } from '@kitbag/tool-metronome';

import { askForNotificationsOnce } from './notificationPermission';
import {
  cardStale,
  keepsAppTempo,
  notificationStepAfterAppChange,
  shownAfterNativeChange,
  storePatchFor,
  transportActive,
  type TransportShown,
} from './transportSync';

let shown: TransportShown | undefined;
let cardNumber = 0;
let applyingNative = false;

function sendCard(next: TransportShown) {
  cardNumber += 1;
  shown = next;
  getKitbagCommands().transportShow({
    ...next,
    cardNumber,
    minBpm: BPM_BOUNDS.min,
    maxBpm: BPM_BOUNDS.max,
  });
}

function hideCard() {
  shown = undefined;
  getKitbagCommands().transportHide();
}

// Reads the latest state: a nested setState can hand later listeners an older snapshot.
function syncFromApp() {
  if (applyingNative) return;
  const step = notificationStepAfterAppChange(
    {
      ...metronomeStore.getState(),
      setlist: transportSetlistOf(transportSubtitle, libraryStore.getState()),
    },
    shown,
    Date.now(),
  );
  if (step.kind === 'show') {
    askForNotificationsOnce();
    sendCard(step.shown);
  } else if (step.kind === 'hide') {
    hideCard();
  }
}

metronomeStore.subscribe(syncFromApp);
libraryStore.subscribe(syncFromApp);

function resendCard() {
  if (shown === undefined) hideCard();
  else sendCard(shown);
}

getKitbagCommands().onTransport((event) => {
  const stale = cardStale(shown, event, cardNumber);
  const keepTempo = keepsAppTempo(event, stale);
  shown = shownAfterNativeChange(shown, event, { keepTempo });
  applyingNative = true;
  try {
    metronomeStore.setState(
      storePatchFor(event, metronomeStore.getState(), { keepTempo }),
    );
  } finally {
    applyingNative = false;
  }
  // The app's newer cards, queued at the service behind the event's card, would
  // overwrite this change when they land, so send the current card after them.
  if (stale) resendCard();
});

export const metronomeTransport = {
  active: () => transportActive(metronomeStore.getState().running, shown),
  release: () => {
    metronomeStore.getState().stop();
    if (shown !== undefined) hideCard();
  },
};
