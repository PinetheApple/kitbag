import type { LibraryRow } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { songRow, stemsRow } from './fixtures.test-helper.ts';
import { storedRowFiles, type StoredFilesRecords } from './storedRowFiles.ts';

const SONG = songRow({ id: 7 });
const STEMS = stemsRow({ id: 7 });

function records(rows: readonly LibraryRow[]): StoredFilesRecords {
  return {
    list: () => Promise.resolve([...rows]),
    listSongFiles: () =>
      Promise.resolve([{ id: 7, filePath: 'songs/a/Everlong.mp3' }]),
    listStemFiles: () =>
      Promise.resolve([
        { setId: 7, filePath: 'stems/r/bass.flac' },
        { setId: 7, filePath: 'stems/r/drums.flac' },
      ]),
  };
}

describe('storedRowFiles', () => {
  it('pairs songs and stem sets with their own audio, never by id alone', async () => {
    expect(await storedRowFiles(records([SONG, STEMS]))).toEqual([
      { row: SONG, audioPaths: ['songs/a/Everlong.mp3'] },
      { row: STEMS, audioPaths: ['stems/r/bass.flac', 'stems/r/drums.flac'] },
    ]);
  });

  it('gives a row with no stored path no audio', async () => {
    const song = songRow({ id: 8 });
    const stems = stemsRow({ id: 8 });
    expect(await storedRowFiles(records([song, stems]))).toEqual([
      { row: song, audioPaths: [] },
      { row: stems, audioPaths: [] },
    ]);
  });
});
