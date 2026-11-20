import {
  queuedSongOf,
  sameQueuedSong,
  type PlayQueueEntry,
  type PlayQueueRepository,
  type QueuedSong,
} from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  libraryStore,
  type LibraryStore,
  type LoadedSong,
} from '../library/store.ts';
import {
  isPresetEntry,
  type PresetSetlistEntry,
  type SetlistEntry,
} from '../library/snapshot.ts';
import {
  ADVANCE,
  advanceOf,
  cursorOf,
  onStageOf,
  upNext,
  queuedSongOfAdvance,
  skippedKindOf,
  wrapOf,
  type Advance,
  type OnStage,
  type PlayerKind,
  type PlayOrder,
  type RepeatRound,
  type SetlistCursor,
  type UpNext,
  type Wrap,
} from './order.ts';
import { crossWrap, roundNow, type UndoWrap } from './repeatWrap.ts';
import { getPlayOrder } from './runtime.ts';

export interface PlayOrderState {
  readonly queue: readonly PlayQueueEntry[];
}

export interface SkipResult {
  readonly advance: Advance;
  readonly skipped: PlayerKind | null;
}

export interface PlayOrderActions {
  refresh: () => Promise<void>;
  enqueue: (song: QueuedSong, position?: number) => Promise<void>;
  playNext: (song: QueuedSong) => Promise<void>;
  addToQueue: (song: QueuedSong) => Promise<void>;
  moveQueued: (song: QueuedSong, position: number) => Promise<void>;
  removeQueued: (song: QueuedSong) => Promise<void>;
  clearQueue: () => Promise<void>;
  playQueued: (song: QueuedSong) => Promise<void>;
  upNext: () => UpNext | undefined;
  advance: () => Promise<Advance>;
  skipToNext: () => Promise<SkipResult>;
  peekNext: () => Promise<SkipResult>;
  commitNext: (next: Advance, stands?: () => boolean) => Promise<Undo | null>;
  openEntry: (entry: SetlistEntry) => Promise<void>;
  commitOpen: (
    entry: PresetSetlistEntry,
    stands?: () => boolean,
  ) => Promise<boolean>;
}

export type PlayOrderStore = PlayOrderState & PlayOrderActions;

export interface PlayOrderDeps {
  readonly queue: () => PlayQueueRepository;
  readonly stage: () => OnStage;
  readonly cursor: () => SetlistCursor | null;
  readonly round?: () => RepeatRound;
  readonly loaded?: () => LoadedSong | null;
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

export type Undo = () => Promise<void>;

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
  round: roundNow,
  loaded: () => libraryStore.getState().loaded,
  refreshStage: () => libraryStore.getState().refresh(),
  playSetlistEntry: (itemId, setlistId) =>
    libraryStore.getState().openStemEntry(itemId, setlistId),
  loadPreset: (presetId, itemId, setlistId) =>
    libraryStore.getState().loadSong(presetId, itemId, setlistId),
  markStage: stageMarkOf(libraryStore),
};

export const QUEUE_FRONT = 0;
const QUEUE_END = Number.MAX_SAFE_INTEGER;

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
  const placed = (song: QueuedSong, position: number) => {
    const queue = deps.queue();
    return edit(
      queue.add(song, position).then(() => queue.move(song, position)),
    );
  };
  return {
    refresh: async () => {
      set({ queue: await deps.queue().list() });
    },
    enqueue: (song: QueuedSong, position?: number) =>
      refreshAfter(deps.queue().add(song, position)),
    playNext: (song: QueuedSong) => placed(song, QUEUE_FRONT),
    addToQueue: (song: QueuedSong) => placed(song, QUEUE_END),
    moveQueued: (song: QueuedSong, position: number) =>
      edit(deps.queue().move(song, position)),
    removeQueued: (song: QueuedSong) => edit(deps.queue().remove(song)),
    clearQueue: () => edit(deps.queue().clear()),
    playQueued: (song: QueuedSong) => edit(deps.queue().takeThrough(song)),
  };
}

const ALWAYS = () => true;

const NOTHING_TO_UNDO: Undo = () => Promise.resolve();

function queueCommit(
  deps: PlayOrderDeps,
  get: Get,
  edits: QueueEdits,
  song: QueuedSong,
): Commit {
  const { queue } = get();
  const through = queue.findIndex((entry) =>
    sameQueuedSong(queuedSongOf(entry), song),
  );
  const taken = queue.slice(0, through + 1);
  let ours = edits.count;
  return {
    write: () => {
      const taking = get().playQueued(song);
      ours = edits.count;
      return taking;
    },
    revert: async () => {
      if (edits.count !== ours) return;
      for (const [position, entry] of taken.entries())
        await deps.queue().add(queuedSongOf(entry), position);
      await get().refresh();
    },
  };
}

function setlistCommit(
  deps: PlayOrderDeps,
  open: () => Promise<unknown>,
): Commit {
  const mark = deps.markStage();
  return {
    write: () => {
      const opening = open();
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
  const queued = queuedSongOfAdvance(next);
  if (queued !== null) return queueCommit(deps, get, edits, queued);
  if (next.kind !== ADVANCE.stems || next.setlistItemId === null) return null;
  const { setlistId } = deps.stage();
  if (setlistId === null) return null;
  const itemId = next.setlistItemId;
  return setlistCommit(deps, () => deps.playSetlistEntry(itemId, setlistId));
}

function presetCommit(deps: PlayOrderDeps, entry: PresetSetlistEntry) {
  const { setlistId } = deps.stage();
  if (setlistId === null) return null;
  return setlistCommit(deps, () =>
    deps.loadPreset(entry.preset.id, entry.item.id, setlistId),
  );
}

async function kept(
  { write, revert }: Commit,
  stands: () => boolean,
): Promise<Undo | null> {
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
  if (stands()) return revert;
  await revert();
  return null;
}

function wrapCrossing(deps: PlayOrderDeps, get: Get) {
  const orderNow = (): PlayOrder => ({
    queue: get().queue,
    stage: deps.stage(),
    cursor: deps.cursor(),
    ...(deps.round === undefined ? {} : { round: deps.round() }),
  });
  const crossOver = (wrap: Wrap): Promise<UndoWrap> => {
    const place = { stage: deps.stage(), loaded: deps.loaded?.() ?? null };
    return crossWrap(wrap, place, {
      queued: () => get().queue.map(queuedSongOf),
      add: (song) => deps.queue().add(song),
      remove: (song) => deps.queue().remove(song),
      refresh: get().refresh,
    });
  };
  const cross = async (): Promise<void> => {
    const wrap = wrapOf(orderNow());
    if (wrap !== null) await crossOver(wrap);
  };
  const crossing = async (
    commit: () => Promise<Undo | null>,
  ): Promise<Undo | null> => {
    const wrap = wrapOf(orderNow());
    if (wrap === null) return commit();
    const undoWrap = await crossOver(wrap);
    let undo: Undo | null;
    try {
      undo = await commit();
    } catch (error) {
      await undoWrap();
      throw error;
    }
    if (undo !== null)
      return async () => {
        await undo();
        await undoWrap();
      };
    await undoWrap();
    return null;
  };
  return { orderNow, cross, crossing };
}

function orderActions(
  deps: PlayOrderDeps,
  get: Get,
  edits: QueueEdits,
  take: (song: QueuedSong) => Promise<void>,
) {
  const { orderNow, cross, crossing } = wrapCrossing(deps, get);
  const peekNext = async (): Promise<SkipResult> => {
    const expected = get().upNext();
    await Promise.all([get().refresh(), deps.refreshStage()]);
    const next = advanceOf(get().upNext());
    return { advance: next, skipped: skippedKindOf(expected, next) };
  };
  const commitNext = (next: Advance, stands = ALWAYS) => {
    if (next.kind === ADVANCE.end) return Promise.resolve(NOTHING_TO_UNDO);
    return crossing(() => {
      const commit = commitOf(deps, get, edits, next);
      return commit === null
        ? Promise.resolve(NOTHING_TO_UNDO)
        : kept(commit, stands);
    });
  };
  const commitOpen = async (entry: PresetSetlistEntry, stands = ALWAYS) => {
    const undo = await crossing(() => {
      const commit = presetCommit(deps, entry);
      return commit === null ? Promise.resolve(null) : kept(commit, stands);
    });
    return undo !== null;
  };
  const playQueued = (song: QueuedSong) => {
    const pending = wrapOf(orderNow())?.songs ?? [];
    if (!pending.some((each) => sameQueuedSong(each, song))) return take(song);
    return cross().then(() => take(song));
  };
  const openEntry = async (entry: SetlistEntry) => {
    const { setlistId } = deps.stage();
    if (setlistId === null) return;
    await cross();
    if (isPresetEntry(entry)) await commitOpen(entry);
    else await deps.playSetlistEntry(entry.item.id, setlistId);
  };
  const skipToNext = async () => {
    const step = await peekNext();
    await commitNext(step.advance);
    return step;
  };
  return {
    upNext: () => upNext(orderNow()),
    playQueued,
    advance: async () => (await skipToNext()).advance,
    skipToNext,
    peekNext,
    commitNext,
    openEntry,
    commitOpen,
  };
}

export function createPlayOrderStore(
  deps: PlayOrderDeps = defaultDeps,
): StoreApi<PlayOrderStore> {
  const edits: QueueEdits = { count: 0 };
  return createStore<PlayOrderStore>((set, get) => {
    const queue = queueActions(deps, set, get, edits);
    return {
      queue: [],
      ...queue,
      ...orderActions(deps, get, edits, queue.playQueued),
    };
  });
}

export const playOrderStore = createPlayOrderStore();
