import type { PlayQueueEntry } from '@kitbag/core-db';

import { activeSetlistOf } from '../library/setlistPosition.ts';
import {
  isPresetEntry,
  type PresetSetlistEntry,
  type SetlistEntry,
} from '../library/snapshot.ts';
import type { LibraryState } from '../library/store.ts';

export const UP_NEXT_SOURCE = { queue: 'queue', setlist: 'setlist' } as const;

export type UpNext =
  | { readonly source: typeof UP_NEXT_SOURCE.queue; readonly stemSetId: number }
  | {
      readonly source: typeof UP_NEXT_SOURCE.setlist;
      readonly entry: SetlistEntry;
    };

export interface OnStage {
  readonly setlistId: number | null;
  readonly entries: readonly SetlistEntry[];
}

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

export const ADVANCE = { play: 'play', open: 'open', end: 'end' } as const;

export type Advance =
  | {
      readonly kind: typeof ADVANCE.play;
      readonly stemSetId: number;
      readonly setlistItemId: number | null;
    }
  | { readonly kind: typeof ADVANCE.open; readonly entry: PresetSetlistEntry }
  | { readonly kind: typeof ADVANCE.end };

export function cursorAt(stage: OnStage, itemId: number): SetlistCursor | null {
  const index = stage.entries.findIndex((entry) => entry.item.id === itemId);
  if (stage.setlistId === null || index < 0) return null;
  return { setlistId: stage.setlistId, itemId, index };
}

export function onStageOf(
  state: Pick<LibraryState, 'setlists' | 'entries'>,
): OnStage {
  const active = activeSetlistOf(state.setlists);
  if (active === undefined) return { setlistId: null, entries: [] };
  const setlistId = active.setlist.id;
  return { setlistId, entries: state.entries[setlistId] ?? [] };
}

export function cursorOf(
  stage: OnStage,
  loaded: LibraryState['loaded'],
): SetlistCursor | null {
  if (loaded?.itemId == null || loaded.setlistId !== stage.setlistId)
    return null;
  return cursorAt(stage, loaded.itemId);
}

function entryAfter(
  entries: readonly SetlistEntry[],
  cursor: SetlistCursor,
): SetlistEntry | undefined {
  const index = entries.findIndex((entry) => entry.item.id === cursor.itemId);
  const removed = index < 0;
  return removed ? entries[cursor.index] : entries[index + 1];
}

function nextSetlistEntry(
  { setlistId, entries }: OnStage,
  cursor: SetlistCursor | null,
): SetlistEntry | undefined {
  if (setlistId === null || cursor?.setlistId !== setlistId) return entries[0];
  return entryAfter(entries, cursor);
}

export function upNext({
  queue,
  stage,
  cursor,
}: PlayOrder): UpNext | undefined {
  const [queued] = queue;
  if (queued !== undefined)
    return { source: UP_NEXT_SOURCE.queue, stemSetId: queued.stemSetId };
  const entry = nextSetlistEntry(stage, cursor);
  return entry === undefined
    ? undefined
    : { source: UP_NEXT_SOURCE.setlist, entry };
}

function itemIdOf(advance: Advance): number | null {
  if (advance.kind === ADVANCE.open) return advance.entry.item.id;
  return advance.kind === ADVANCE.play ? advance.setlistItemId : null;
}

export function advanceSkipped(
  expected: UpNext | undefined,
  advance: Advance,
): boolean {
  if (expected === undefined) return false;
  if (expected.source === UP_NEXT_SOURCE.setlist)
    return itemIdOf(advance) !== expected.entry.item.id;
  return !(
    advance.kind === ADVANCE.play &&
    advance.setlistItemId === null &&
    advance.stemSetId === expected.stemSetId
  );
}

export function advanceOf(next: UpNext | undefined): Advance {
  if (next === undefined) return { kind: ADVANCE.end };
  if (next.source === UP_NEXT_SOURCE.queue)
    return {
      kind: ADVANCE.play,
      stemSetId: next.stemSetId,
      setlistItemId: null,
    };
  const { entry } = next;
  if (isPresetEntry(entry)) return { kind: ADVANCE.open, entry };
  return {
    kind: ADVANCE.play,
    stemSetId: entry.stemSetId,
    setlistItemId: entry.item.id,
  };
}
