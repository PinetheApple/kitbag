import { useStore } from 'zustand';

import { songPlayerStore, type SongPlayerStore } from './store.ts';

export function useSongPlayer<T>(selector: (state: SongPlayerStore) => T): T {
  return useStore(songPlayerStore, selector);
}
