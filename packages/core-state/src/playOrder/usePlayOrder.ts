import { queuedSongOf, sameQueuedSong, type QueuedSong } from '@kitbag/core-db';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';

import { libraryStore } from '../library/store.ts';
import type { SetlistPlace } from './autoAdvance.ts';
import {
  cursorOf,
  onStageOf,
  upcoming,
  upNext,
  type OnStage,
  type PlayOrder,
  type RepeatRound,
  type SetlistCursor,
  type Upcoming,
  type UpNext,
} from './order.ts';
import { useShownSong } from './nowPlaying.ts';
import { heardStore } from './heard.ts';
import { backFromOf, backOf } from './previous.ts';
import { repeatStore, roundOf, type RepeatMode } from './repeat.ts';
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
  readonly round: RepeatRound;
  readonly name: string;
}

export function useStage(): Stage {
  const setlists = useStore(libraryStore, (s) => s.setlists);
  const entries = useStore(libraryStore, (s) => s.entries);
  const loaded = useStore(libraryStore, (s) => s.loaded);
  const session = useStore(libraryStore, (s) => s.session);
  const mode = useStore(repeatStore, (s) => s.mode);
  const played = useStore(repeatStore, (s) => s.played);
  const restart = useStore(repeatStore, (s) => s.restart);
  return useMemo(() => {
    const stage = onStageOf({ setlists, entries, session });
    const name =
      setlists.find((s) => s.setlist.id === stage.setlistId)?.setlist.name ??
      '';
    const round = roundOf({ mode, played, restart }, stage.setlistId, loaded);
    return { stage, cursor: cursorOf(stage, loaded), round, name };
  }, [setlists, entries, loaded, session, mode, played, restart]);
}

function usePlayOrderNow(): PlayOrder {
  const queue = usePlayOrder((s) => s.queue);
  const { stage, cursor, round } = useStage();
  return useMemo(
    () => ({ queue, stage, cursor, round }),
    [queue, stage, cursor, round],
  );
}

export function useUpNext(): UpNext | undefined {
  const order = usePlayOrderNow();
  return useMemo(() => upNext(order), [order]);
}

export function useUpcoming(): Upcoming {
  const order = usePlayOrderNow();
  return useMemo(() => upcoming(order), [order]);
}

export function useUpNextCount(): number {
  const queueLength = usePlayOrder((s) => s.queue.length);
  const { pending, setlist } = useUpcoming();
  return queueLength + pending.length + setlist.length;
}

export interface SetlistSpot extends SetlistPlace {
  readonly setlistName: string;
}

export function useSetlistSpot(setId: number): SetlistSpot | null {
  const loaded = useStore(libraryStore, (s) => s.loaded);
  const { stage, cursor, name } = useStage();
  if (cursor === null || loaded === null) return null;
  if (loaded.presetId !== null || loaded.stemSetId !== setId) return null;
  return {
    setlistName: name,
    number: cursor.index + 1,
    of: stage.entries.length,
  };
}

export function useCanGoBack(): boolean {
  const heard = useStore(heardStore, (s) => s.heard);
  const loaded = useStore(libraryStore, (s) => s.loaded);
  const { stage } = useStage();
  const from = backFromOf(useShownSong(), heard, loaded, stage);
  return from !== null && backOf(from) !== null;
}

export function useRepeatMode(): RepeatMode {
  return useStore(repeatStore, (s) => s.mode);
}

export function useRepeatAllHintSeen(): boolean {
  return useStore(repeatStore, (s) => s.allHintSeen);
}
