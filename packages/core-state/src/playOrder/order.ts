import {
  queuedSongOf,
  sameQueuedSong,
  type PlayQueueEntry,
  type QueuedSong,
} from '@kitbag/core-db';

import { adjacentEntry, SONG_STEP } from '../library/setlistPosition.ts';
import {
  isPresetEntry,
  type PresetSetlistEntry,
  type SetlistEntry,
} from '../library/snapshot.ts';
import type { LibraryState } from '../library/store.ts';

export const UP_NEXT_SOURCE = { queue: 'queue', setlist: 'setlist' } as const;

export type UpNext =
  | { readonly source: typeof UP_NEXT_SOURCE.queue; readonly song: QueuedSong }
  | {
      readonly source: typeof UP_NEXT_SOURCE.setlist;
      readonly entry: SetlistEntry;
    };

export interface OnStage {
  readonly setlistId: number | null;
  readonly entries: readonly SetlistEntry[];
  readonly skipped: readonly number[];
}

const NO_STAGE: OnStage = { setlistId: null, entries: [], skipped: [] };

export interface SetlistCursor {
  readonly setlistId: number;
  readonly itemId: number;
  readonly index: number;
}

export interface PlayOrder {
  readonly queue: readonly PlayQueueEntry[];
  readonly stage: OnStage;
  readonly cursor: SetlistCursor | null;
}

export type PlayerKind = QueuedSong['kind'];

export const ADVANCE = {
  stems: 'stems',
  song: 'song',
  open: 'open',
  end: 'end',
} as const;

export type Advance =
  | {
      readonly kind: typeof ADVANCE.stems;
      readonly stemSetId: number;
      readonly setlistItemId: number | null;
    }
  | { readonly kind: typeof ADVANCE.song; readonly songId: number }
  | { readonly kind: typeof ADVANCE.open; readonly entry: PresetSetlistEntry }
  | { readonly kind: typeof ADVANCE.end };

export function cursorAt(stage: OnStage, itemId: number): SetlistCursor | null {
  const index = stage.entries.findIndex((entry) => entry.item.id === itemId);
  if (stage.setlistId === null || index < 0) return null;
  return { setlistId: stage.setlistId, itemId, index };
}

export function onStageOf(
  state: Pick<LibraryState, 'setlists' | 'entries' | 'session'>,
): OnStage {
  const { session } = state;
  if (session === null) return NO_STAGE;
  const { setlistId, skipped } = session;
  if (!state.setlists.some((summary) => summary.setlist.id === setlistId))
    return NO_STAGE;
  return { setlistId, entries: state.entries[setlistId] ?? [], skipped };
}

export function cursorOf(
  stage: OnStage,
  loaded: LibraryState['loaded'],
): SetlistCursor | null {
  if (loaded?.itemId == null || loaded.setlistId !== stage.setlistId)
    return null;
  const { setlistId, itemId, index } = loaded;
  if (setlistId === null) return null;
  return index === undefined
    ? cursorAt(stage, itemId)
    : { setlistId, itemId, index };
}

export function entriesAfter(
  stage: OnStage,
  cursor: SetlistCursor | null,
): readonly SetlistEntry[] {
  const next = nextSetlistEntry(stage, cursor);
  if (next === undefined) return [];
  return stage.entries
    .slice(stage.entries.indexOf(next))
    .filter((entry) => !isSkipped(stage, entry));
}

function isSkipped({ skipped }: OnStage, entry: SetlistEntry): boolean {
  return skipped.includes(entry.item.id);
}

function nextSetlistEntry(
  stage: OnStage,
  cursor: SetlistCursor | null,
): SetlistEntry | undefined {
  const { setlistId, entries } = stage;
  const after =
    setlistId === null || cursor?.setlistId !== setlistId
      ? entries[0]
      : adjacentEntry(entries, cursor, SONG_STEP.next);
  if (after === undefined) return undefined;
  return entries
    .slice(entries.indexOf(after))
    .find((entry) => !isSkipped(stage, entry));
}

export function upNext({
  queue,
  stage,
  cursor,
}: PlayOrder): UpNext | undefined {
  const [queued] = queue;
  if (queued !== undefined)
    return { source: UP_NEXT_SOURCE.queue, song: queuedSongOf(queued) };
  const entry = nextSetlistEntry(stage, cursor);
  return entry === undefined
    ? undefined
    : { source: UP_NEXT_SOURCE.setlist, entry };
}

export type PlayAdvance = Extract<
  Advance,
  { readonly kind: typeof ADVANCE.stems | typeof ADVANCE.song }
>;

export const isPlayAdvance = (next: Advance): next is PlayAdvance =>
  next.kind === ADVANCE.stems || next.kind === ADVANCE.song;

export function songOfPlay(next: PlayAdvance): QueuedSong {
  return next.kind === ADVANCE.song
    ? { kind: 'song', id: next.songId }
    : { kind: 'stems', id: next.stemSetId };
}

export function queuedSongOfAdvance(advance: Advance): QueuedSong | null {
  if (advance.kind === ADVANCE.song)
    return { kind: 'song', id: advance.songId };
  if (advance.kind !== ADVANCE.stems || advance.setlistItemId !== null)
    return null;
  return { kind: 'stems', id: advance.stemSetId };
}

function itemIdOf(advance: Advance): number | null {
  if (advance.kind === ADVANCE.open) return advance.entry.item.id;
  return advance.kind === ADVANCE.stems ? advance.setlistItemId : null;
}

export function advanceSkipped(
  expected: UpNext | undefined,
  advance: Advance,
): boolean {
  if (expected === undefined) return false;
  if (expected.source === UP_NEXT_SOURCE.setlist)
    return itemIdOf(advance) !== expected.entry.item.id;
  const queued = queuedSongOfAdvance(advance);
  return queued === null || !sameQueuedSong(queued, expected.song);
}

export function kindOfUpNext(next: UpNext): PlayerKind {
  return next.source === UP_NEXT_SOURCE.queue ? next.song.kind : 'stems';
}

export function skippedKindOf(
  expected: UpNext | undefined,
  advance: Advance,
): PlayerKind | null {
  return expected !== undefined && advanceSkipped(expected, advance)
    ? kindOfUpNext(expected)
    : null;
}

export function advanceOf(next: UpNext | undefined): Advance {
  if (next === undefined) return { kind: ADVANCE.end };
  if (next.source === UP_NEXT_SOURCE.queue) {
    const { song } = next;
    return song.kind === 'song'
      ? { kind: ADVANCE.song, songId: song.id }
      : { kind: ADVANCE.stems, stemSetId: song.id, setlistItemId: null };
  }
  const { entry } = next;
  if (isPresetEntry(entry)) return { kind: ADVANCE.open, entry };
  return {
    kind: ADVANCE.stems,
    stemSetId: entry.stemSetId,
    setlistItemId: entry.item.id,
  };
}
