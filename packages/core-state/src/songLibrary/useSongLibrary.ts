import { useStore } from 'zustand';

import { songLibraryStore, type SongLibraryStore } from './store.ts';

export function useSongLibrary<T>(selector: (state: SongLibraryStore) => T): T {
  return useStore(songLibraryStore, selector);
}
