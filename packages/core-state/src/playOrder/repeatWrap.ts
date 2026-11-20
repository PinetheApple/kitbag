import type { QueuedSong } from '@kitbag/core-db';

import { libraryStore, type LoadedSong } from '../library/store.ts';
import { setlistWraps, upNext, type PlayOrder } from './order.ts';
import { playOrderNow, subscribePlayOrder } from './orderNow.ts';
import { REPEAT, repeatStore } from './repeat.ts';
import { playOrderStore } from './store.ts';

export interface RepeatWrapDeps {
  readonly order: () => PlayOrder;
  readonly loaded: () => LoadedSong | null;
  readonly requeue: (songs: readonly QueuedSong[]) => Promise<void>;
  readonly subscribe: (listener: () => void) => () => void;
}

const defaultDeps: RepeatWrapDeps = {
  order: playOrderNow,
  loaded: () => libraryStore.getState().loaded,
  requeue: async (songs) => {
    for (const song of songs) await playOrderStore.getState().enqueue(song);
  },
  subscribe: subscribePlayOrder,
};

export function startRepeatWrap(deps: RepeatWrapDeps = defaultDeps) {
  let wrapping = false;
  const look = () => {
    const { mode, played } = repeatStore.getState();
    if (wrapping || mode !== REPEAT.all) return;
    const order = deps.order();
    if (order.restarted === true || upNext(order) !== undefined) return;
    const { setlistId } = order.stage;
    const restarts = setlistWraps(order.stage);
    if (setlistId !== null && !restarts) return;
    if (!restarts && played.length === 0) return;
    const from = deps.loaded();
    wrapping = true;
    deps
      .requeue(played)
      .then(() => {
        repeatStore.setState({
          played: [],
          restart: restarts && setlistId !== null ? { setlistId, from } : null,
        });
      })
      .catch((error: unknown) => {
        console.warn('[kitbag] repeating the queue failed', error);
      })
      .finally(() => {
        wrapping = false;
      });
  };
  look();
  return deps.subscribe(look);
}
