import type { QueuedSong } from '@kitbag/core-db';

import { adjacentEntry, SONG_STEP } from '../library/setlistPosition.ts';
import {
  isPresetEntry,
  type PresetSetlistEntry,
  type SetlistEntry,
} from '../library/snapshot.ts';
import { libraryStore, type LoadedSong } from '../library/store.ts';
import {
  droppedTrailing,
  heardAfter,
  heardStore,
  type HeardSong,
} from './heard.ts';
import { shownSong } from './nowPlaying.ts';
import {
  cursorOf,
  onStageOf,
  type OnStage,
  type SetlistCursor,
} from './order.ts';
import { playOrderStore, stageMarkOf, type Undo } from './store.ts';

export const PREVIOUS_RESTARTS_AFTER_SECONDS = 3;

export const BACK = { song: 'song', setlist: 'setlist' } as const;

interface Leaving {
  readonly left: QueuedSong;
  readonly requeue: QueuedSong | null;
  readonly fromHistory: boolean;
}

export type Back =
  | (Leaving & { readonly kind: typeof BACK.song; readonly song: QueuedSong })
  | (Leaving & {
      readonly kind: typeof BACK.setlist;
      readonly entry: SetlistEntry;
    });

export interface BackFrom {
  readonly heard: readonly HeardSong[];
  readonly current: HeardSong;
  readonly stage: OnStage;
  readonly cursor: SetlistCursor | null;
}

export function heardOf(
  song: QueuedSong,
  loaded: LoadedSong | null,
): HeardSong {
  const fromSetlist =
    song.kind === 'stems' &&
    loaded?.presetId === null &&
    loaded.stemSetId === song.id;
  return { song, setlistItemId: fromSetlist ? loaded.itemId : null };
}

function stageEntry(
  stage: OnStage,
  itemId: number | null,
): SetlistEntry | undefined {
  if (itemId === null) return undefined;
  return stage.entries.find((entry) => entry.item.id === itemId);
}

export function backOf({
  heard,
  current,
  stage,
  cursor,
}: BackFrom): Back | null {
  const left = current.song;
  const leftEntry = stageEntry(stage, current.setlistItemId);
  const before = droppedTrailing(heard, left).at(-1);
  if (before !== undefined) {
    const entry = stageEntry(stage, before.setlistItemId);
    const requeue =
      leftEntry !== undefined && entry !== undefined ? null : left;
    const leaving = { left, requeue, fromHistory: true };
    return entry === undefined
      ? { kind: BACK.song, song: before.song, ...leaving }
      : { kind: BACK.setlist, entry, ...leaving };
  }
  if (leftEntry === undefined || cursor === null) return null;
  const entry = adjacentEntry(stage.entries, cursor, SONG_STEP.previous);
  if (entry === undefined) return null;
  return { kind: BACK.setlist, entry, left, requeue: null, fromHistory: false };
}

export function songOfBack(back: Back): QueuedSong | null {
  if (back.kind === BACK.song) return back.song;
  const { entry } = back;
  return isPresetEntry(entry) ? null : { kind: 'stems', id: entry.stemSetId };
}

export function presetOfBack(back: Back): PresetSetlistEntry | null {
  if (back.kind !== BACK.setlist || !isPresetEntry(back.entry)) return null;
  return back.entry;
}

export function heardOfBack(back: Back): HeardSong | null {
  const song = songOfBack(back);
  if (song === null) return null;
  return {
    song,
    setlistItemId: back.kind === BACK.setlist ? back.entry.item.id : null,
  };
}

export function backFromOf(
  song: QueuedSong | null,
  heard: readonly HeardSong[],
  loaded: LoadedSong | null,
  stage: OnStage,
): BackFrom | null {
  if (song === null) return null;
  const current = heardOf(song, loaded);
  return { heard, current, stage, cursor: cursorOf(stage, loaded) };
}

export function backFromNow(): BackFrom | null {
  const library = libraryStore.getState();
  return backFromOf(
    shownSong(),
    heardStore.getState().heard,
    library.loaded,
    onStageOf(library),
  );
}

const NOTHING_TO_UNDO: Undo = () => Promise.resolve();

export async function openBack(back: Back): Promise<Undo | null> {
  if (back.kind !== BACK.setlist || isPresetEntry(back.entry))
    return NOTHING_TO_UNDO;
  const library = libraryStore.getState();
  const { setlistId } = onStageOf(library);
  if (setlistId === null) return null;
  const mark = stageMarkOf(libraryStore)();
  if (!(await library.openStemEntry(back.entry.item.id, setlistId))) {
    mark.restore();
    return null;
  }
  mark.wrote();
  return () => {
    mark.restore();
    return Promise.resolve();
  };
}

export async function settleBack(back: Back, from: BackFrom): Promise<void> {
  const kept = droppedTrailing(from.heard, back.left);
  const target = heardOfBack(back);
  heardStore.setState({
    heard: target === null ? kept : heardAfter(kept, target),
  });
  if (back.requeue !== null)
    await playOrderStore.getState().playNext(back.requeue);
}
