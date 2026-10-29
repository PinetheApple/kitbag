import { useStore } from 'zustand';

import { stemPlayerStore, type StemPlayerStore } from './store.ts';

export function useStemPlayer<T>(selector: (state: StemPlayerStore) => T): T {
  return useStore(stemPlayerStore, selector);
}
