import type { QueuedSong } from '@kitbag/core-db';

import { adjacentEntry, SONG_STEP } from '../library/setlistPosition.ts';
import { droppedTrailing, type HeardSong } from '../library/setlistSession.ts';
import { isPresetEntry, type SetlistEntry } from '../library/snapshot.ts';
import { libraryStore, type LoadedSong } from '../library/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import {
  cursorOf,
  onStageOf,
  type OnStage,
  type PlayerKind,
  type SetlistCursor,
} from './order.ts';
import { playOrderStore } from './store.ts';

export const PREVIOUS_RESTARTS_AFTER_SECONDS = 3;

export const BACK = { song: 'song', setlist: 'setlist' } as const;

interface Leaving {
  readonly left: QueuedSong;
  readonly requeue: QueuedSong | null;
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
    return entry === undefined
      ? { kind: BACK.song, song: before.song, left, requeue }
      : { kind: BACK.setlist, entry, left, requeue };
  }
  if (leftEntry === undefined || cursor === null) return null;
  const entry = adjacentEntry(stage.entries, cursor, SONG_STEP.previous);
  return entry === undefined
    ? null
    : { kind: BACK.setlist, entry, left, requeue: null };
}

function shownId(from: PlayerKind): number | null {
  return from === 'stems'
    ? stemPlayerStore.getState().setId
    : songPlayerStore.getState().songId;
}

export function backNow(from: PlayerKind): Back | null {
  const id = shownId(from);
  if (id === null) return null;
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return backOf({
    heard: library.heard,
    current: heardOf({ kind: from, id }, library.loaded),
    stage,
    cursor: cursorOf(stage, library.loaded),
  });
}

export async function commitBack(back: Back): Promise<void> {
  const library = libraryStore.getState();
  library.unhearSong(back.left);
  if (back.requeue !== null)
    await playOrderStore.getState().playNext(back.requeue);
  if (back.kind !== BACK.setlist || isPresetEntry(back.entry)) return;
  const { setlistId } = onStageOf(library);
  if (setlistId !== null)
    await library.openStemEntry(back.entry.item.id, setlistId);
}
