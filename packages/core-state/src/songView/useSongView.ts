import { useStore } from 'zustand';

import { songViewStore, type SongViewStore } from './songView.ts';

export function useSongView<T>(selector: (state: SongViewStore) => T): T {
  return useStore(songViewStore, selector);
}
