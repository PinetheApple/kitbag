import { useStore } from 'zustand';

import { getSwipeHintStore, type SwipeHintStore } from './store.ts';

export function useSwipeHint<T>(selector: (state: SwipeHintStore) => T): T {
  return useStore(getSwipeHintStore(), selector);
}
