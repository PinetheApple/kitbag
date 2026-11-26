import { useStore } from 'zustand';

import { songPlayerStore, type SongPlayerStore } from './store.ts';

export function useLiveSongPlayer<T>(
  selector: (state: SongPlayerStore) => T,
): T {
  return useStore(songPlayerStore, selector);
}
