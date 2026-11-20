import type { LibrarySongRow, QueuedSong } from '@kitbag/core-db';

import { bpmFact } from '../stemPlayer/facts.ts';
import { UP_NEXT_SOURCE, type PlayerKind, type UpNext } from './order.ts';
import {
  entryName,
  joinedFacts,
  songLengthFact,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  stemFacts,
  stemSongTitle,
  type StemSongs,
} from './stemSongText.ts';

export const UNKNOWN_SONG = 'Song';
export const SKIPPED_SONG = 'Skipped a song that was deleted';
export const SKIPPED_UNOPENED_SONG = 'Skipped a song that would not open';

export const SKIP = { deleted: 'deleted', unopened: 'unopened' } as const;

export type Skip = (typeof SKIP)[keyof typeof SKIP];

export interface SkippedSong {
  readonly reason: Skip;
  readonly kind: PlayerKind;
}

const SKIPPED_TEXT: Readonly<
  Record<PlayerKind, Readonly<Record<Skip, string>>>
> = {
  stems: {
    [SKIP.deleted]: SKIPPED_STEM_SONG,
    [SKIP.unopened]: SKIPPED_UNOPENED_STEM_SONG,
  },
  song: {
    [SKIP.deleted]: SKIPPED_SONG,
    [SKIP.unopened]: SKIPPED_UNOPENED_SONG,
  },
};

export function skippedText({ reason, kind }: SkippedSong): string {
  return SKIPPED_TEXT[kind][reason];
}

export type SingleSongs = ReadonlyMap<number, LibrarySongRow>;

export interface LibrarySongs {
  readonly stems: StemSongs;
  readonly songs: SingleSongs;
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

export function queuedSongFacts(
  song: QueuedSong,
  library: LibrarySongs,
): string {
  if (song.kind === 'stems') return stemFacts(song.id, library.stems);
  const row = library.songs.get(song.id);
  return row === undefined
    ? ''
    : joinedFacts([songLengthFact(row), bpmFact(row.bpm)?.text ?? null]);
}

export function singleSongsById(
  rows: readonly { readonly kind: string }[],
): SingleSongs {
  const songs = rows.filter(
    (row): row is LibrarySongRow => row.kind === 'song',
  );
  return new Map(songs.map((row) => [row.id, row]));
}
