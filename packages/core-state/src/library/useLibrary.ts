import { useStore } from 'zustand';

import { libraryStore, type LibraryStore } from './store.ts';

export function useLibrary<T>(selector: (state: LibraryStore) => T): T {
  return useStore(libraryStore, selector);
}
