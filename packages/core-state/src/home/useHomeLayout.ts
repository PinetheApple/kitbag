import { useStore } from 'zustand';

import { getHomeLayoutStore, type HomeLayoutStore } from './store.ts';

export function useHomeLayout<T>(selector: (state: HomeLayoutStore) => T): T {
  return useStore(getHomeLayoutStore(), selector);
}
