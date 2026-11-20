import { queuedSongOf, sameQueuedSong, type QueuedSong } from '@kitbag/core-db';
import { useEffect, useMemo } from 'react';
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

const QUEUE_READ_FAILED = '[kitbag] play queue read failed';
const QUEUE_ADD_FAILED = '[kitbag] play queue add failed';

export function useQueueRefresh() {
  const refresh = usePlayOrder((s) => s.refresh);
  useEffect(() => {
    refresh().catch((error: unknown) => {
      console.warn(QUEUE_READ_FAILED, error);
    });
  }, [refresh]);
}

export type QueueSong = (song: QueuedSong) => Promise<boolean>;

export interface QueueSongs {
  readonly playNext: QueueSong;
  readonly addToQueue: QueueSong;
}

function reported(queue: (song: QueuedSong) => Promise<void>): QueueSong {
  return (song) =>
    queue(song).then(
      () => true,
      (error: unknown) => {
        console.warn(QUEUE_ADD_FAILED, error);
        return false;
      },
    );
}

export function useQueueSong(): QueueSongs {
  const playNext = usePlayOrder((s) => s.playNext);
  const addToQueue = usePlayOrder((s) => s.addToQueue);
  return useMemo(
    () => ({ playNext: reported(playNext), addToQueue: reported(addToQueue) }),
    [playNext, addToQueue],
  );
}

export function useIsQueued(song: QueuedSong | null): boolean {
  return usePlayOrder((s) =>
    s.queue.some(
      (entry) => song !== null && sameQueuedSong(queuedSongOf(entry), song),
    ),
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
  const session = useStore(libraryStore, (s) => s.session);
  return useMemo(() => {
    const stage = onStageOf({ setlists, entries, session });
    const name =
      setlists.find((s) => s.setlist.id === stage.setlistId)?.setlist.name ??
      '';
    return { stage, cursor: cursorOf(stage, loaded), name };
  }, [setlists, entries, loaded, session]);
}

export function useUpNext(): UpNext | undefined {
  const queue = usePlayOrder((s) => s.queue);
  const { stage, cursor } = useStage();
  return useMemo(
    () => upNext({ queue, stage, cursor }),
    [queue, stage, cursor],
  );
}
