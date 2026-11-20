import type { SetlistEntry, SetlistSummary } from './snapshot.ts';

export const SONG_STEP = { previous: -1, next: 1 } as const;

export type SongStep = (typeof SONG_STEP)[keyof typeof SONG_STEP];

export interface StagePosition {
  readonly itemId: number | null;
  readonly index?: number;
}

export function activeSetlistOf(
  setlists: readonly SetlistSummary[],
): SetlistSummary | undefined {
  return setlists.find((summary) => summary.setlist.active);
}

export function stagePositionOf(
  loaded: (StagePosition & { readonly setlistId: number | null }) | null,
  setlistId: number,
): StagePosition | null {
  return loaded?.setlistId === setlistId ? loaded : null;
}

function removedStep(
  entries: readonly SetlistEntry[],
  index: number,
  step: SongStep,
): SetlistEntry | undefined {
  if (step === SONG_STEP.next) return entries[index];
  return entries[Math.min(index, entries.length) + step];
}

export function adjacentEntry(
  entries: readonly SetlistEntry[],
  position: StagePosition | null,
  step: SongStep,
): SetlistEntry | undefined {
  const itemId = position?.itemId ?? null;
  const index = entries.findIndex((entry) => entry.item.id === itemId);
  if (index >= 0) return entries[index + step];
  if (itemId !== null && position?.index !== undefined)
    return removedStep(entries, position.index, step);
  return step === SONG_STEP.next ? entries[0] : undefined;
}

export function indexIn(
  entries: readonly SetlistEntry[] | undefined,
  itemId: number,
): number {
  return (entries ?? []).findIndex((entry) => entry.item.id === itemId);
}

function survivorsBefore(
  previous: readonly SetlistEntry[],
  next: readonly SetlistEntry[],
  index: number,
): number {
  const kept = new Set(next.map((entry) => entry.item.id));
  return previous.slice(0, index).filter((entry) => kept.has(entry.item.id))
    .length;
}

type EntriesBySetlist = Readonly<Record<number, readonly SetlistEntry[]>>;

export function followedIndex<
  T extends StagePosition & { readonly setlistId: number | null },
>(
  loaded: T | null,
  previous: EntriesBySetlist,
  next: EntriesBySetlist,
): T | null {
  if (loaded?.setlistId == null || loaded.itemId === null) return loaded;
  const entries = next[loaded.setlistId] ?? [];
  const present = indexIn(entries, loaded.itemId);
  const index =
    present >= 0 || loaded.index === undefined
      ? present
      : survivorsBefore(
          previous[loaded.setlistId] ?? [],
          entries,
          loaded.index,
        );
  if (index < 0 || index === loaded.index) return loaded;
  return { ...loaded, index };
}
