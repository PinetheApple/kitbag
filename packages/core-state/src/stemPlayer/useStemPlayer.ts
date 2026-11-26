import { useStore } from 'zustand';

import { stemPlayerStore, type StemPlayerStore } from './store.ts';

export function useLiveStemPlayer<T>(
  selector: (state: StemPlayerStore) => T,
): T {
  return useStore(stemPlayerStore, selector);
}
