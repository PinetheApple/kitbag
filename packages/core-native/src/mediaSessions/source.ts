import {
  getKitbagMediaSessions,
  type MediaSessionsEvent,
  type MediaSessionWire,
  type Spec,
} from '../NativeKitbagMediaSessions';
import type {
  MediaSessionCommand,
  MediaSessionSnapshot,
  MediaSessionsListener,
  MediaSessionStep,
} from './types.ts';
import { SPOKEN_WORD_APPS } from './spokenWordApps.ts';

const toSnapshot = (wire: MediaSessionWire): MediaSessionSnapshot => ({
  ...wire,
  spokenWord: SPOKEN_WORD_APPS.has(wire.packageName),
});

export function toMediaSessionSnapshots(
  event: MediaSessionsEvent,
): readonly MediaSessionSnapshot[] {
  return event.sessions.map(toSnapshot);
}

const listeners = new Set<MediaSessionsListener>();
let subscription: { remove: () => void } | undefined;
let latest: readonly MediaSessionSnapshot[] | undefined;

function deliver(event: MediaSessionsEvent): void {
  const sessions = toMediaSessionSnapshots(event);
  latest = sessions;
  listeners.forEach((listener) => {
    listener(sessions);
  });
}

function stopWatching(): void {
  subscription?.remove();
  subscription = undefined;
  latest = undefined;
  getKitbagMediaSessions().setWatching(false);
}

export function subscribeMediaSessions(
  listener: MediaSessionsListener,
): () => void {
  const watcher: MediaSessionsListener = (sessions) => {
    listener(sessions);
  };
  listeners.add(watcher);
  if (subscription === undefined) {
    const native = getKitbagMediaSessions();
    subscription = native.onSessions(deliver);
    native.setWatching(true);
  } else if (latest !== undefined) {
    watcher(latest);
  }
  return () => {
    if (listeners.delete(watcher) && listeners.size === 0) stopWatching();
  };
}

const STEPS: Record<
  MediaSessionStep,
  (native: Spec, sessionId: string) => void
> = {
  play: (native, sessionId) => {
    native.play(sessionId);
  },
  pause: (native, sessionId) => {
    native.pause(sessionId);
  },
  next: (native, sessionId) => {
    native.skipToNext(sessionId);
  },
  previous: (native, sessionId) => {
    native.skipToPrevious(sessionId);
  },
};

export function mediaSessionCommand(
  sessionId: string,
  command: MediaSessionCommand,
): void {
  const native = getKitbagMediaSessions();
  if (command.type === 'seekTo') native.seekTo(sessionId, command.positionMs);
  else STEPS[command.type](native, sessionId);
}

export function isNotificationListenerEnabled(): Promise<boolean> {
  return getKitbagMediaSessions().listenerEnabled();
}

export function openNotificationListenerSettings(): void {
  getKitbagMediaSessions().openListenerSettings();
}
