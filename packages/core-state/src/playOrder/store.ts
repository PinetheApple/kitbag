import type { PlayQueueEntry, PlayQueueRepository } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { activeSetlistOf } from '../library/setlistPosition.ts';
import { libraryStore } from '../library/store.ts';
import {
  ADVANCE,
  advanceOf,
  cursorAt,
  upNext,
  type Advance,
  type OnStage,
  type SetlistCursor,
  type UpNext,
} from './order.ts';
import { getPlayOrder } from './runtime.ts';

export interface PlayOrderState {
  readonly queue: readonly PlayQueueEntry[];
  readonly cursor: SetlistCursor | null;
}

export interface PlayOrderActions {
  refresh: () => Promise<void>;
  enqueue: (stemSetId: number, position?: number) => Promise<void>;
  moveQueued: (stemSetId: number, position: number) => Promise<void>;
  removeQueued: (stemSetId: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  playQueued: (stemSetId: number) => Promise<void>;
  playSetlistEntry: (itemId: number | null) => void;
  upNext: () => UpNext | undefined;
  advance: () => Promise<Advance>;
}

export type PlayOrderStore = PlayOrderState & PlayOrderActions;

export interface PlayOrderDeps {
  readonly queue: () => PlayQueueRepository;
  readonly stage: () => OnStage;
}

function onStage(): OnStage {
  const state = libraryStore.getState();
  const active = activeSetlistOf(state.setlists);
  if (active === undefined) return { setlistId: null, entries: [] };
  const setlistId = active.setlist.id;
  return { setlistId, entries: state.entries[setlistId] ?? [] };
}

const defaultDeps: PlayOrderDeps = {
  queue: () => getPlayOrder().queue,
  stage: onStage,
};

type SetState = StoreApi<PlayOrderStore>['setState'];
type Get = StoreApi<PlayOrderStore>['getState'];

function queueActions(deps: PlayOrderDeps, set: SetState, get: Get) {
  const refreshAfter = async (work: Promise<unknown>) => {
    await work;
    await get().refresh();
  };
  return {
    refresh: async () => {
      set({ queue: await deps.queue().list() });
    },
    enqueue: (stemSetId: number, position?: number) =>
      refreshAfter(deps.queue().add(stemSetId, position)),
    moveQueued: (stemSetId: number, position: number) =>
      refreshAfter(deps.queue().move(stemSetId, position)),
    removeQueued: (stemSetId: number) =>
      refreshAfter(deps.queue().remove(stemSetId)),
    clearQueue: () => refreshAfter(deps.queue().clear()),
    playQueued: (stemSetId: number) =>
      refreshAfter(deps.queue().takeThrough(stemSetId)),
  };
}

function orderActions(deps: PlayOrderDeps, set: SetState, get: Get) {
  return {
    playSetlistEntry: (itemId: number | null) => {
      set({ cursor: itemId === null ? null : cursorAt(deps.stage(), itemId) });
    },
    upNext: () =>
      upNext({
        queue: get().queue,
        stage: deps.stage(),
        cursor: get().cursor,
      }),
    advance: async () => {
      await get().refresh();
      const advance = advanceOf(get().upNext());
      if (advance.kind !== ADVANCE.play) return advance;
      if (advance.setlistItemId === null)
        await get().playQueued(advance.stemSetId);
      else get().playSetlistEntry(advance.setlistItemId);
      return advance;
    },
  };
}

export function createPlayOrderStore(
  deps: PlayOrderDeps = defaultDeps,
): StoreApi<PlayOrderStore> {
  return createStore<PlayOrderStore>((set, get) => ({
    queue: [],
    cursor: null,
    ...queueActions(deps, set, get),
    ...orderActions(deps, set, get),
  }));
}

export const playOrderStore = createPlayOrderStore();
