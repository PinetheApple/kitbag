import type { PlayQueueEntry, PlayQueueRepository } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
import { isPresetEntry, type SetlistEntry } from '../library/snapshot.ts';
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
  openEntry: (entry: SetlistEntry) => Promise<void>;
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
  readonly loadPreset: (
    presetId: number,
    itemId: number,
    setlistId: number,
  ) => Promise<unknown>;
  readonly markStage: () => StageMark;
}

export interface StageMark {
  readonly wrote: () => void;
  readonly restore: () => void;
}

interface Commit {
  readonly write: () => Promise<unknown>;
  readonly revert: () => Promise<void>;
}

export function stageMarkOf(library: StoreApi<LibraryStore>) {
  return (): StageMark => {
    const { loaded, played, discarded } = library.getState();
    let written = loaded;
    return {
      wrote: () => {
        written = library.getState().loaded;
      },
      restore: () => {
        if (library.getState().loaded !== written) return;
        library.setState({ loaded, played, discarded });
      },
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
  loadPreset: (presetId, itemId, setlistId) =>
    libraryStore.getState().loadSong(presetId, itemId, setlistId),
  markStage: stageMarkOf(libraryStore),
};

type SetState = StoreApi<PlayOrderStore>['setState'];
type Get = StoreApi<PlayOrderStore>['getState'];

interface QueueEdits {
  count: number;
}

function queueActions(
  deps: PlayOrderDeps,
  set: SetState,
  get: Get,
  edits: QueueEdits,
) {
  const refreshAfter = async (work: Promise<unknown>) => {
    await work;
    await get().refresh();
  };
  const edit = (work: Promise<unknown>) => {
    edits.count++;
    return refreshAfter(work);
  };
  return {
    refresh: async () => {
      set({ queue: await deps.queue().list() });
    },
    enqueue: (stemSetId: number, position?: number) =>
      refreshAfter(deps.queue().add(stemSetId, position)),
    moveQueued: (stemSetId: number, position: number) =>
      edit(deps.queue().move(stemSetId, position)),
    removeQueued: (stemSetId: number) => edit(deps.queue().remove(stemSetId)),
    clearQueue: () => edit(deps.queue().clear()),
    playQueued: (stemSetId: number) =>
      edit(deps.queue().takeThrough(stemSetId)),
  };
}

const ALWAYS = () => true;

function queueCommit(
  deps: PlayOrderDeps,
  get: Get,
  edits: QueueEdits,
  stemSetId: number,
): Commit {
  const { queue } = get();
  const through = queue.findIndex((entry) => entry.stemSetId === stemSetId);
  const taken = queue.slice(0, through + 1);
  let ours = edits.count;
  return {
    write: () => {
      const taking = get().playQueued(stemSetId);
      ours = edits.count;
      return taking;
    },
    revert: async () => {
      if (edits.count !== ours) return;
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
  const mark = deps.markStage();
  return {
    write: () => {
      const opening = deps.playSetlistEntry(itemId, setlistId);
      mark.wrote();
      return opening;
    },
    revert: () => {
      mark.restore();
      return Promise.resolve();
    },
  };
}

function commitOf(
  deps: PlayOrderDeps,
  get: Get,
  edits: QueueEdits,
  next: Advance,
) {
  if (next.kind !== ADVANCE.play) return null;
  if (next.setlistItemId === null)
    return queueCommit(deps, get, edits, next.stemSetId);
  const { setlistId } = deps.stage();
  if (setlistId === null) return null;
  return setlistCommit(deps, next.setlistItemId, setlistId);
}

async function kept({ write, revert }: Commit, stands: () => boolean) {
  try {
    await write();
  } catch (error) {
    await revert().catch((undoError: unknown) => {
      console.warn(
        '[kitbag] undoing a failed play order step failed',
        undoError,
      );
    });
    throw error;
  }
  if (stands()) return true;
  await revert();
  return false;
}

function orderActions(deps: PlayOrderDeps, get: Get, edits: QueueEdits) {
  const peekNext = async (): Promise<SkipResult> => {
    const expected = get().upNext();
    await Promise.all([get().refresh(), deps.refreshStage()]);
    const next = advanceOf(get().upNext());
    return { advance: next, skipped: advanceSkipped(expected, next) };
  };
  const commitNext = async (next: Advance, stands = ALWAYS) => {
    const commit = commitOf(deps, get, edits, next);
    return commit === null || kept(commit, stands);
  };
  const openEntry = async (entry: SetlistEntry) => {
    const { setlistId } = deps.stage();
    if (setlistId === null) return;
    if (isPresetEntry(entry))
      await deps.loadPreset(entry.preset.id, entry.item.id, setlistId);
    else await deps.playSetlistEntry(entry.item.id, setlistId);
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
    openEntry,
  };
}

export function createPlayOrderStore(
  deps: PlayOrderDeps = defaultDeps,
): StoreApi<PlayOrderStore> {
  const edits: QueueEdits = { count: 0 };
  return createStore<PlayOrderStore>((set, get) => ({
    queue: [],
    ...queueActions(deps, set, get, edits),
    ...orderActions(deps, get, edits),
  }));
}

export const playOrderStore = createPlayOrderStore();
