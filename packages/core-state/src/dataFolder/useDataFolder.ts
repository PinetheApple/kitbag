import { useStore } from 'zustand';

import { dataFolderStore, type DataFolderStore } from './store.ts';

export function useDataFolder<T>(selector: (state: DataFolderStore) => T): T {
  return useStore(dataFolderStore, selector);
}
