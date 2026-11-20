import type { PlayQueueEntry, PlayQueueRepository } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import {
  ADVANCE,
  advanceOf,
  advanceSkipped,
  cursorOf,
  onStageOf,
  upNext,
  type Advance,
  type OnStage,
  type SetlistCursor,
  type UpNext,
} from './order.ts';
import { getPlayOrder } from './runtime.ts';

export interface PlayOrderState {
  readonly queue: readonly PlayQueueEntry[];
}

export interface SkipResult {
  readonly advance: Advance;
  readonly skipped: boolean;
}

export interface PlayOrderActions {
  refresh: () => Promise<void>;
  enqueue: (stemSetId: number, position?: number) => Promise<void>;
  moveQueued: (stemSetId: number, position: number) => Promise<void>;
  removeQueued: (stemSetId: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  playQueued: (stemSetId: number) => Promise<void>;
  upNext: () => UpNext | undefined;
  advance: () => Promise<Advance>;
  skipToNext: () => Promise<SkipResult>;
  peekNext: () => Promise<SkipResult>;
  commitNext: (next: Advance) => Promise<void>;
}

export type PlayOrderStore = PlayOrderState & PlayOrderActions;

export interface PlayOrderDeps {
  readonly queue: () => PlayQueueRepository;
  readonly stage: () => OnStage;
  readonly cursor: () => SetlistCursor | null;
  readonly refreshStage: () => Promise<void>;
  readonly playSetlistEntry: (
    itemId: number,
    setlistId: number,
  ) => Promise<unknown>;
}

const stageNow = () => onStageOf(libraryStore.getState());

const defaultDeps: PlayOrderDeps = {
  queue: () => getPlayOrder().queue,
  stage: stageNow,
  cursor: () => cursorOf(stageNow(), libraryStore.getState().loaded),
  refreshStage: () => libraryStore.getState().refresh(),
  playSetlistEntry: (itemId, setlistId) =>
    libraryStore.getState().openStemEntry(itemId, setlistId),
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

function orderActions(deps: PlayOrderDeps, get: Get) {
  const peekNext = async (): Promise<SkipResult> => {
    const expected = get().upNext();
    await Promise.all([get().refresh(), deps.refreshStage()]);
    const next = advanceOf(get().upNext());
    return { advance: next, skipped: advanceSkipped(expected, next) };
  };
  const commitNext = async (next: Advance) => {
    if (next.kind !== ADVANCE.play) return;
    const { setlistId } = deps.stage();
    if (next.setlistItemId === null) await get().playQueued(next.stemSetId);
    else if (setlistId !== null)
      await deps.playSetlistEntry(next.setlistItemId, setlistId);
  };
  const skipToNext = async () => {
    const step = await peekNext();
    await commitNext(step.advance);
    return step;
  };
  return {
    upNext: () =>
      upNext({
        queue: get().queue,
        stage: deps.stage(),
        cursor: deps.cursor(),
      }),
    advance: async () => (await skipToNext()).advance,
    skipToNext,
    peekNext,
    commitNext,
  };
}

export function createPlayOrderStore(
  deps: PlayOrderDeps = defaultDeps,
): StoreApi<PlayOrderStore> {
  return createStore<PlayOrderStore>((set, get) => ({
    queue: [],
    ...queueActions(deps, set, get),
    ...orderActions(deps, get),
  }));
}

export const playOrderStore = createPlayOrderStore();
