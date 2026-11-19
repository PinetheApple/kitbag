import { useMemo } from 'react';
import { useStore } from 'zustand';

import { libraryStore } from '../library/store.ts';
import { cursorOf, onStageOf, upNext, type UpNext } from './order.ts';
import { playOrderStore, type PlayOrderStore } from './store.ts';

export function usePlayOrder<T>(selector: (state: PlayOrderStore) => T): T {
  return useStore(playOrderStore, selector);
}

export function useUpNext(): UpNext | undefined {
  const queue = usePlayOrder((s) => s.queue);
  const setlists = useStore(libraryStore, (s) => s.setlists);
  const entries = useStore(libraryStore, (s) => s.entries);
  const loaded = useStore(libraryStore, (s) => s.loaded);
  return useMemo(() => {
    const stage = onStageOf({ setlists, entries });
    return upNext({ queue, stage, cursor: cursorOf(stage, loaded) });
  }, [queue, setlists, entries, loaded]);
}
