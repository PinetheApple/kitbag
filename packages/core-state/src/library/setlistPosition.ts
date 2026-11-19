import {
  isPresetEntry,
  type PresetSetlistEntry,
  type SetlistEntry,
  type SetlistSummary,
} from './snapshot.ts';

export const SONG_STEP = { previous: -1, next: 1 } as const;

export type SongStep = (typeof SONG_STEP)[keyof typeof SONG_STEP];

export function activeSetlistOf(
  setlists: readonly SetlistSummary[],
): SetlistSummary | undefined {
  return setlists.find((summary) => summary.setlist.active);
}

export function adjacentPresetEntry(
  entries: readonly SetlistEntry[],
  loadedItemId: number | null,
  step: SongStep,
): PresetSetlistEntry | undefined {
  const playable = entries.filter(isPresetEntry);
  const index = playable.findIndex((entry) => entry.item.id === loadedItemId);
  if (index < 0) return step === SONG_STEP.next ? playable[0] : undefined;
  return playable[index + step];
}
