import type { LibraryRow, StemSetRecord, StoredStem } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { storedRowFiles, type StoredFilesRecords } from './storedRowFiles.ts';

const created = new Date(0);

const SONG: LibraryRow = {
  kind: 'song',
  id: 7,
  title: 'Everlong',
  artist: 'Foo Fighters',
  durationSec: 250,
  bpm: null,
  hasGrid: false,
  analysisStatus: 'done',
  analysisError: null,
  inSetlist: false,
  createdAt: created,
};

const STEMS: LibraryRow = {
  kind: 'stems',
  id: 7,
  title: 'Redbone',
  stemCount: 2,
  durationSec: 326,
  bpm: null,
  key: null,
  scale: null,
  hasGrid: false,
  createdAt: created,
};

const stem = (filePath: string) => ({ filePath }) as StoredStem;

function records(
  rows: readonly LibraryRow[],
  stems: readonly StoredStem[] | undefined,
): StoredFilesRecords {
  return {
    list: () => Promise.resolve([...rows]),
    listSongFiles: () =>
      Promise.resolve([{ id: 7, filePath: 'songs/a/Everlong.mp3' }]),
    readStemSet: () =>
      Promise.resolve(
        stems === undefined ? undefined : ({ stems } as StemSetRecord),
      ),
  };
}

describe('storedRowFiles', () => {
  it('pairs songs and stem sets with their own audio, never by id alone', async () => {
    const stems = [stem('stems/r/bass.flac'), stem('stems/r/drums.flac')];
    expect(await storedRowFiles(records([SONG, STEMS], stems))).toEqual([
      { row: SONG, audioPaths: ['songs/a/Everlong.mp3'] },
      { row: STEMS, audioPaths: ['stems/r/bass.flac', 'stems/r/drums.flac'] },
    ]);
  });

  it('gives a row with no stored path no audio', async () => {
    const orphan = { ...SONG, id: 8 };
    expect(await storedRowFiles(records([orphan, STEMS], undefined))).toEqual([
      { row: orphan, audioPaths: [] },
      { row: STEMS, audioPaths: [] },
    ]);
  });
});
