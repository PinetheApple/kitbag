import { countLabel } from '@kitbag/core-design';
import {
  isPresetEntry,
  type ActiveSet,
  type SetlistEntry,
} from '@kitbag/core-state';

import { entryName, type StemSongs } from '@kitbag/core-state';

export interface SongListRow {
  readonly itemId: number;
  readonly presetId: number | null;
  readonly stemSetId: number | null;
  readonly number: string;
  readonly name: string;
  readonly bpm: string | null;
  readonly now: boolean;
}

export const STEM_SONG_HINT = 'A stem song opens in the stem player.';

export function songListHint(set: ActiveSet): string {
  const where =
    set.position === undefined
      ? countLabel(set.count, 'song', 'songs')
      : `song ${String(set.position)} of ${String(set.count)}`;
  return `On stage · ${where} · tap a song to load it`;
}

export function songListRows(
  entries: readonly SetlistEntry[],
  loadedItemId: number | null,
  stems: StemSongs,
): SongListRow[] {
  return entries.map((entry, index) => {
    const preset = isPresetEntry(entry) ? entry.preset : null;
    return {
      itemId: entry.item.id,
      presetId: preset?.id ?? null,
      stemSetId: isPresetEntry(entry) ? null : entry.stemSetId,
      number: String(index + 1),
      name: entryName(entry, stems),
      bpm: preset === null ? null : String(Math.round(preset.bpm)),
      now: entry.item.id === loadedItemId,
    };
  });
}
