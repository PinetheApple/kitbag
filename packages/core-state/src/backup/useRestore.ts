import { useStore } from 'zustand';

import { restoreStore, type RestoreStore } from './restore.ts';

export function useRestore<T>(selector: (state: RestoreStore) => T): T {
  return useStore(restoreStore, selector);
}
