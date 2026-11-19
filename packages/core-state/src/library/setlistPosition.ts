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
  return entries[step === SONG_STEP.next ? index : index + step];
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
