import { getMediaSessionsStore, getPlayAlongStore } from '@kitbag/core-state';

export function pickSource(sessionId: string): void {
  const { lock, unlock } = getPlayAlongStore().getState();
  if (lock !== undefined && lock.sessionId !== sessionId) unlock();
  getMediaSessionsStore().getState().pick(sessionId);
}
