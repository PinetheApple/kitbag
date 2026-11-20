import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';

import { libraryStore, type LoadedSong } from '../library/store.ts';
import {
  onStageOf,
  type OnStage,
  type RepeatRound,
  type Wrap,
} from './order.ts';
import { repeatStore, roundOf } from './repeat.ts';

export function roundNow(): RepeatRound {
  const library = libraryStore.getState();
  return roundOf(
    repeatStore.getState(),
    onStageOf(library).setlistId,
    library.loaded,
  );
}

export interface WrapQueue {
  readonly queued: () => readonly QueuedSong[];
  readonly add: (song: QueuedSong) => Promise<unknown>;
  readonly remove: (song: QueuedSong) => Promise<unknown>;
  readonly refresh: () => Promise<void>;
}

export interface WrapPlace {
  readonly stage: OnStage;
  readonly loaded: LoadedSong | null;
}

export type UndoWrap = () => Promise<void>;

export async function crossWrap(
  wrap: Wrap,
  { stage, loaded }: WrapPlace,
  queue: WrapQueue,
): Promise<UndoWrap> {
  const { played, restart } = repeatStore.getState();
  const added = wrap.songs.filter(
    (song) => !queue.queued().some((queued) => sameQueuedSong(queued, song)),
  );
  for (const song of added) await queue.add(song);
  await queue.refresh();
  const { setlistId } = stage;
  repeatStore.setState({
    played: [],
    restart:
      wrap.restartsSetlist && setlistId !== null
        ? { setlistId, from: loaded }
        : null,
  });
  return async () => {
    for (const song of added) await queue.remove(song);
    await queue.refresh();
    repeatStore.setState({ played, restart });
  };
}
