import { useMemo } from 'react';
import { useStore } from 'zustand';

import { libraryStore } from '../library/store.ts';
import {
  cursorOf,
  onStageOf,
  upNext,
  type OnStage,
  type SetlistCursor,
  type UpNext,
} from './order.ts';
import { playOrderStore, type PlayOrderStore } from './store.ts';

export function usePlayOrder<T>(selector: (state: PlayOrderStore) => T): T {
  return useStore(playOrderStore, selector);
}

export function useIsQueued(stemSetId: number | null): boolean {
  return usePlayOrder((s) =>
    s.queue.some((entry) => entry.stemSetId === stemSetId),
  );
}

export interface Stage {
  readonly stage: OnStage;
  readonly cursor: SetlistCursor | null;
  readonly name: string;
}

export function useStage(): Stage {
  const setlists = useStore(libraryStore, (s) => s.setlists);
  const entries = useStore(libraryStore, (s) => s.entries);
  const loaded = useStore(libraryStore, (s) => s.loaded);
  return useMemo(() => {
    const stage = onStageOf({ setlists, entries });
    const name =
      setlists.find((s) => s.setlist.id === stage.setlistId)?.setlist.name ??
      '';
    return { stage, cursor: cursorOf(stage, loaded), name };
  }, [setlists, entries, loaded]);
}

export function useUpNext(): UpNext | undefined {
  const queue = usePlayOrder((s) => s.queue);
  const { stage, cursor } = useStage();
  return useMemo(
    () => upNext({ queue, stage, cursor }),
    [queue, stage, cursor],
  );
}
