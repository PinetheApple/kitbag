import type {
  LibrarySongRow,
  LibraryStemSetRow,
  QueuedSong,
} from '@kitbag/core-db';

import { isPresetEntry, type SetlistEntry } from '../library/snapshot.ts';

import { bpmFact, shortKeyName } from '../stemPlayer/facts.ts';
import { UP_NEXT_SOURCE, type UpNext } from './order.ts';
import { formatClockSeconds } from '../text.ts';

const FACT_SEPARATOR = ' · ';

export const SKIPPED_STEM_SONG = 'Skipped a stem song that was deleted';
export const SKIPPED_UNOPENED_STEM_SONG =
  'Skipped a stem song that would not open';
export const STEMS_BADGE = 'STEMS';
export const UNKNOWN_STEM_SONG = 'Stem song';
export const UNKNOWN_SONG = 'Song';

export type StemSongs = ReadonlyMap<number, LibraryStemSetRow>;
export type SingleSongs = ReadonlyMap<number, LibrarySongRow>;

export interface LibrarySongs {
  readonly stems: StemSongs;
  readonly songs: SingleSongs;
}

export function stemSongTitle(stemSetId: number, stems: StemSongs): string {
  return stems.get(stemSetId)?.title ?? UNKNOWN_STEM_SONG;
}

export function entryName(entry: SetlistEntry, stems: StemSongs): string {
  return isPresetEntry(entry)
    ? entry.preset.name
    : stemSongTitle(entry.stemSetId, stems);
}

export function queuedSongTitle(
  song: QueuedSong,
  library: LibrarySongs,
): string {
  return song.kind === 'stems'
    ? stemSongTitle(song.id, library.stems)
    : (library.songs.get(song.id)?.title ?? UNKNOWN_SONG);
}

export function upNextTitle(next: UpNext, library: LibrarySongs): string {
  return next.source === UP_NEXT_SOURCE.queue
    ? queuedSongTitle(next.song, library)
    : entryName(next.entry, library.stems);
}

function lengthOf(row: Pick<LibraryStemSetRow, 'durationSec'>): string | null {
  return row.durationSec > 0
    ? formatClockSeconds(Math.round(row.durationSec))
    : null;
}

function joined(parts: readonly (string | null)[]): string {
  return parts
    .filter((part) => part !== null && part !== '')
    .join(FACT_SEPARATOR);
}

export function stemFacts(stemSetId: number, stems: StemSongs): string {
  const song = stems.get(stemSetId);
  return song === undefined ? '' : stemSongFacts(song);
}

export function stemSongFacts(row: LibraryStemSetRow): string {
  return joined([
    lengthOf(row),
    shortKeyName(row.key, row.scale),
    bpmFact(row.bpm)?.text ?? null,
  ]);
}

export function queuedSongFacts(
  song: QueuedSong,
  library: LibrarySongs,
): string {
  if (song.kind === 'stems') return stemFacts(song.id, library.stems);
  const row = library.songs.get(song.id);
  return row === undefined
    ? ''
    : joined([lengthOf(row), bpmFact(row.bpm)?.text ?? null]);
}

export function stemSongListFacts(row: LibraryStemSetRow): string {
  return joined([row.artist, lengthOf(row), shortKeyName(row.key, row.scale)]);
}

export function singleSongsById(
  rows: readonly { readonly kind: string }[],
): SingleSongs {
  const songs = rows.filter(
    (row): row is LibrarySongRow => row.kind === 'song',
  );
  return new Map(songs.map((row) => [row.id, row]));
}

export function stemSongsById(
  rows: readonly { readonly kind: string }[],
): ReadonlyMap<number, LibraryStemSetRow> {
  const stems = rows.filter(
    (row): row is LibraryStemSetRow => row.kind === 'stems',
  );
  return new Map(stems.map((row) => [row.id, row]));
}
