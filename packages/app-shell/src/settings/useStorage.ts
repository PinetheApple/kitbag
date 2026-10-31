import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  EMPTY_STORAGE,
  storageLoader,
  type StorageSnapshot,
} from './storageModel.ts';
import { storageDeps } from './storageRuntime';

export function useStorage() {
  const [snapshot, setSnapshot] = useState<StorageSnapshot>(EMPTY_STORAGE);
  const loader = useMemo(() => storageLoader(storageDeps, setSnapshot), []);
  const refresh = useCallback(() => {
    void loader.refresh();
  }, [loader]);
  const removeMissing = useCallback(() => {
    void loader.removeMissing();
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      return loader.cancel;
    }, [refresh, loader]),
  );
  return { ...snapshot, refresh, removeMissing };
}
