import { useStore } from 'zustand';

import { stemDeckStore, type StemDeckStore } from './store.ts';

export function useStemDeck<T>(selector: (state: StemDeckStore) => T): T {
  return useStore(stemDeckStore, selector);
}
