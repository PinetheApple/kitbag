import { useStore } from 'zustand';

import { getGetSongBpmKeyStore, type GetSongBpmKeyStore } from './store.ts';

export function useGetSongBpmKey<T>(
  selector: (state: GetSongBpmKeyStore) => T,
): T {
  return useStore(getGetSongBpmKeyStore(), selector);
}
