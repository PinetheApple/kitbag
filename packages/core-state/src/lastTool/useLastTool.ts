import { useStore } from 'zustand';

import { getLastToolStore, type LastToolStore } from './store.ts';

export function useLastTool<T>(selector: (state: LastToolStore) => T): T {
  return useStore(getLastToolStore(), selector);
}
