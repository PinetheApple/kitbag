import type { SetlistEntry, SetlistSummary } from './snapshot.ts';

export const SONG_STEP = { previous: -1, next: 1 } as const;

export type SongStep = (typeof SONG_STEP)[keyof typeof SONG_STEP];

export function activeSetlistOf(
  setlists: readonly SetlistSummary[],
): SetlistSummary | undefined {
  return setlists.find((summary) => summary.setlist.active);
}

export function adjacentEntry(
  entries: readonly SetlistEntry[],
  loadedItemId: number | null,
  step: SongStep,
): SetlistEntry | undefined {
  const index = entries.findIndex((entry) => entry.item.id === loadedItemId);
  if (index < 0) return step === SONG_STEP.next ? entries[0] : undefined;
  return entries[index + step];
}
