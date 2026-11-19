import {
  isPresetEntry,
  type LibraryStemSetRow,
  type SetlistEntry,
} from '@kitbag/core-state';

export type StemSongs = ReadonlyMap<number, LibraryStemSetRow>;

export const STEMS_BADGE = 'STEMS';
export const UNKNOWN_STEM_SONG = 'Stem song';

export function entryName(entry: SetlistEntry, stems: StemSongs): string {
  if (isPresetEntry(entry)) return entry.preset.name;
  return stems.get(entry.stemSetId)?.title ?? UNKNOWN_STEM_SONG;
}
