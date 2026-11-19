import { getKitbagCommands, type TransportEvent } from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  libraryStore,
  metronomeStore,
  mixerClick,
  transportSetlistOf,
  type MetronomeStore,
} from '@kitbag/core-state';
import { transportSubtitle } from '@kitbag/tool-metronome';

import { askForNotificationsOnce } from './notificationPermission';
import {
  cardStale,
  notificationStepAfterAppChange,
  replayOnApp,
  shownAfterNativeChange,
  shownAfterReplay,
  storePatchFor,
  transportActive,
  type Replay,
  type TransportShown,
} from './transportSync';

let shown: TransportShown | undefined;
let cardNumber = 0;
let cardIssued = false;
let handedOver = false;
let syncHeld = false;

function sendCard(next: TransportShown) {
  cardNumber += 1;
  shown = next;
  cardIssued = true;
  handedOver = false;
  getKitbagCommands().transportShow({
    ...next,
    cardNumber,
    minBpm: BPM_BOUNDS.min,
    maxBpm: BPM_BOUNDS.max,
  });
}

function withdrawCard() {
  cardNumber += 1;
  shown = undefined;
  cardIssued = true;
}

function hideCard() {
  withdrawCard();
  getKitbagCommands().transportHide();
}

function handOverCard() {
  withdrawCard();
  getKitbagCommands().transportHandOver();
}

// Reads the latest state: a nested setState can hand later listeners an older snapshot.
function syncFromApp() {
  if (syncHeld) return;
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

function withoutSync(change: () => void) {
  syncHeld = true;
  try {
    change();
  } finally {
    syncHeld = false;
  }
}

function followService(event: TransportEvent) {
  shown = shownAfterNativeChange(shown, event);
  if (shown === undefined) cardIssued = false;
  withoutSync(() => {
    metronomeStore.setState(storePatchFor(event, metronomeStore.getState()));
  });
}

function applyReplay(step: Replay, metronome: MetronomeStore) {
  if (step.kind === 'start') metronome.start();
  if (step.kind === 'pause') metronome.pause();
  if (step.kind === 'stop') metronome.stop();
  if (step.kind === 'step') metronome.nudgeTempo(step.delta, step.from);
}

// The service acted on a card the app has since replaced, so redo its action on the app's state.
function replay(event: TransportEvent) {
  const sent = cardNumber;
  const metronome = metronomeStore.getState();
  const step = replayOnApp(event, metronome);
  if (step.kind === 'follow') {
    followService(event);
    resendCard();
    return;
  }
  withoutSync(() => {
    applyReplay(step, metronome);
  });
  shown = shownAfterReplay(shown, step);
  syncFromApp();
  // The app's newer cards, queued at the service behind the event's card, would
  // overwrite this change when they land, so send the current card after them.
  if (cardNumber === sent) resendCard();
}

function stopClickTheServiceStarted() {
  const metronome = metronomeStore.getState();
  if (metronome.running || mixerClick.active()) return;
  withoutSync(() => {
    metronome.stop();
  });
}

getKitbagCommands().onTransport((event) => {
  if (handedOver) stopClickTheServiceStarted();
  else if (cardStale(cardIssued, event, cardNumber)) replay(event);
  else followService(event);
});

export const metronomeTransport = {
  active: () => transportActive(metronomeStore.getState().running, shown),
  release: () => {
    handOverCard();
    withoutSync(() => {
      metronomeStore.getState().stop();
    });
    handedOver = true;
  },
};
