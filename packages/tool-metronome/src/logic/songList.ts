import { countLabel } from '@kitbag/core-design';
import {
  entryName,
  isPresetEntry,
  type ActiveSet,
  type SetlistEntry,
  type StemSongs,
} from '@kitbag/core-state';

import { TEMPO_FROM_SONG } from './songSummary.ts';

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
const STEM_SONG_SPOKEN = 'stem song';

export function songRowTempo(row: SongListRow): string | null {
  if (row.stemSetId !== null) return null;
  return row.bpm ?? TEMPO_FROM_SONG;
}

export function songRowSpoken(row: SongListRow): string {
  const tempo = row.bpm === null ? TEMPO_FROM_SONG : `${row.bpm} BPM`;
  const detail = row.stemSetId === null ? tempo : STEM_SONG_SPOKEN;
  return `${row.number}. ${row.name}, ${detail}`;
}

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
    const bpm = preset?.bpm ?? null;
    return {
      itemId: entry.item.id,
      presetId: preset?.id ?? null,
      stemSetId: isPresetEntry(entry) ? null : entry.stemSetId,
      number: String(index + 1),
      name: entryName(entry, stems),
      bpm: bpm === null ? null : String(Math.round(bpm)),
      now: entry.item.id === loadedItemId,
    };
  });
}
