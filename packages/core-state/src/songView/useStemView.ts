import { useStore } from 'zustand';

import { stemViewStore, type StemViewStore } from './stemView.ts';

export function useStemView<T>(selector: (state: StemViewStore) => T): T {
  return useStore(stemViewStore, selector);
}
