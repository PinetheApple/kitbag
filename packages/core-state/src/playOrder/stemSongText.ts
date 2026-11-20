import type { LibraryStemSetRow } from '@kitbag/core-db';

import { isPresetEntry, type SetlistEntry } from '../library/snapshot.ts';

import { bpmFact, shortKeyName } from '../stemPlayer/facts.ts';
import { formatClockSeconds } from '../text.ts';

const FACT_SEPARATOR = ' · ';

export const SKIPPED_STEM_SONG = 'Skipped a stem song that was deleted';
export const SKIPPED_UNOPENED_STEM_SONG =
  'Skipped a stem song that would not open';
export const STEMS_BADGE = 'STEMS';
export const UNKNOWN_STEM_SONG = 'Stem song';

export type StemSongs = ReadonlyMap<number, LibraryStemSetRow>;

export function stemSongTitle(stemSetId: number, stems: StemSongs): string {
  return stems.get(stemSetId)?.title ?? UNKNOWN_STEM_SONG;
}

export function entryName(entry: SetlistEntry, stems: StemSongs): string {
  return isPresetEntry(entry)
    ? entry.preset.name
    : stemSongTitle(entry.stemSetId, stems);
}

export function songLengthFact(
  row: Pick<LibraryStemSetRow, 'durationSec'>,
): string | null {
  return row.durationSec > 0
    ? formatClockSeconds(Math.round(row.durationSec))
    : null;
}

export function joinedFacts(parts: readonly (string | null)[]): string {
  return parts
    .filter((part) => part !== null && part !== '')
    .join(FACT_SEPARATOR);
}

export function stemFacts(stemSetId: number, stems: StemSongs): string {
  const song = stems.get(stemSetId);
  return song === undefined ? '' : stemSongFacts(song);
}

export function stemSongFacts(row: LibraryStemSetRow): string {
  return joinedFacts([
    songLengthFact(row),
    shortKeyName(row.key, row.scale),
    bpmFact(row.bpm)?.text ?? null,
  ]);
}

export function stemSongListFacts(row: LibraryStemSetRow): string {
  return joinedFacts([
    row.artist,
    songLengthFact(row),
    shortKeyName(row.key, row.scale),
  ]);
}

export function stemSongsById(
  rows: readonly { readonly kind: string }[],
): ReadonlyMap<number, LibraryStemSetRow> {
  const stems = rows.filter(
    (row): row is LibraryStemSetRow => row.kind === 'stems',
  );
  return new Map(stems.map((row) => [row.id, row]));
}
