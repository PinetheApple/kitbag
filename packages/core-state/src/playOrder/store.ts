import type { PlayQueueEntry, PlayQueueRepository } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
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
  commitNext: (next: Advance, stands?: () => boolean) => Promise<boolean>;
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
  readonly markStage: () => RestoreStage;
}

export type RestoreStage = () => void;

interface Commit {
  readonly write: () => Promise<unknown>;
  readonly revert: () => Promise<void>;
}

export function stageMarkOf(library: StoreApi<LibraryStore>) {
  return (): RestoreStage => {
    const { loaded, played, discarded } = library.getState();
    return () => {
      library.setState({ loaded, played, discarded });
    };
  };
}

const stageNow = () => onStageOf(libraryStore.getState());

const defaultDeps: PlayOrderDeps = {
  queue: () => getPlayOrder().queue,
  stage: stageNow,
  cursor: () => cursorOf(stageNow(), libraryStore.getState().loaded),
  refreshStage: () => libraryStore.getState().refresh(),
  playSetlistEntry: (itemId, setlistId) =>
    libraryStore.getState().openStemEntry(itemId, setlistId),
  markStage: stageMarkOf(libraryStore),
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

const ALWAYS = () => true;

function queueCommit(deps: PlayOrderDeps, get: Get, stemSetId: number): Commit {
  const { queue } = get();
  const through = queue.findIndex((entry) => entry.stemSetId === stemSetId);
  const taken = queue.slice(0, through + 1);
  return {
    write: () => get().playQueued(stemSetId),
    revert: async () => {
      for (const [position, entry] of taken.entries())
        await deps.queue().add(entry.stemSetId, position);
      await get().refresh();
    },
  };
}

function setlistCommit(
  deps: PlayOrderDeps,
  itemId: number,
  setlistId: number,
): Commit {
  const restore = deps.markStage();
  return {
    write: () => deps.playSetlistEntry(itemId, setlistId),
    revert: () => {
      if (deps.cursor()?.itemId === itemId) restore();
      return Promise.resolve();
    },
  };
}

function commitOf(deps: PlayOrderDeps, get: Get, next: Advance) {
  if (next.kind !== ADVANCE.play) return null;
  if (next.setlistItemId === null)
    return queueCommit(deps, get, next.stemSetId);
  const { setlistId } = deps.stage();
  if (setlistId === null) return null;
  return setlistCommit(deps, next.setlistItemId, setlistId);
}

async function kept({ write, revert }: Commit, stands: () => boolean) {
  try {
    await write();
  } catch (error) {
    await revert();
    throw error;
  }
  if (stands()) return true;
  await revert();
  return false;
}

function orderActions(deps: PlayOrderDeps, get: Get) {
  const peekNext = async (): Promise<SkipResult> => {
    const expected = get().upNext();
    await Promise.all([get().refresh(), deps.refreshStage()]);
    const next = advanceOf(get().upNext());
    return { advance: next, skipped: advanceSkipped(expected, next) };
  };
  const commitNext = async (next: Advance, stands = ALWAYS) => {
    const commit = commitOf(deps, get, next);
    return commit === null || kept(commit, stands);
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
