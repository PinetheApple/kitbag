import { useStore } from 'zustand';

import { getMediaSessionsStore, type MediaSessionsStore } from './store.ts';

export function useMediaSessions<T>(
  selector: (state: MediaSessionsStore) => T,
): T {
  return useStore(getMediaSessionsStore(), selector);
}
