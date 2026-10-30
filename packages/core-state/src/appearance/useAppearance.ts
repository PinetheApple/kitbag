import { useStore } from 'zustand';

import { getAppearanceStore, type AppearanceStore } from './store.ts';

export function useAppearance<T>(selector: (state: AppearanceStore) => T): T {
  return useStore(getAppearanceStore(), selector);
}
