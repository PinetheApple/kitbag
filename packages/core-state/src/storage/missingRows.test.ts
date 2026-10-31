import type { LibraryRow } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import {
  findMissingRows,
  removeMissingRows,
  type StoredRowFiles,
} from './missingRows.ts';

const created = new Date(0);

const SONG: LibraryRow = {
  kind: 'song',
  id: 1,
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

const OTHER_SONG: LibraryRow = { ...SONG, id: 2, title: 'Take Five' };

const STEMS: LibraryRow = {
  kind: 'stems',
  id: 1,
  title: 'Redbone',
  stemCount: 2,
  durationSec: 326,
  bpm: null,
  key: null,
  scale: null,
  hasGrid: false,
  createdAt: created,
};

const STORED: readonly StoredRowFiles[] = [
  { row: SONG, audioPaths: ['songs/a/Everlong.mp3'] },
  { row: OTHER_SONG, audioPaths: ['songs/b/TakeFive.mp3'] },
  { row: STEMS, audioPaths: ['stems/r/bass.flac', 'stems/r/drums.flac'] },
];

function deps(missing: readonly string[], stored = STORED) {
  return {
    storedFiles: vi.fn(() => Promise.resolve(stored)),
    missingFiles: vi.fn((paths: readonly string[]) =>
      Promise.resolve(paths.filter((path) => missing.includes(path))),
    ),
    deleteRow: vi.fn<(row: LibraryRow) => Promise<void>>(() =>
      Promise.resolve(),
    ),
  };
}

describe('findMissingRows', () => {
  it('asks about every stored audio path in one call', async () => {
    const source = deps([]);
    await findMissingRows(source);
    expect(source.missingFiles).toHaveBeenCalledTimes(1);
    expect(source.missingFiles).toHaveBeenCalledWith([
      'songs/a/Everlong.mp3',
      'songs/b/TakeFive.mp3',
      'stems/r/bass.flac',
      'stems/r/drums.flac',
    ]);
  });

  it('maps a missing song file back to its row', async () => {
    expect(await findMissingRows(deps(['songs/b/TakeFive.mp3']))).toEqual([
      OTHER_SONG,
    ]);
  });

  it('keeps a stem set while any of its stems is still on disk', async () => {
    expect(await findMissingRows(deps(['stems/r/bass.flac']))).toEqual([]);
  });

  it('reports a stem set once every stem is gone', async () => {
    const gone = ['stems/r/bass.flac', 'stems/r/drums.flac'];
    expect(await findMissingRows(deps(gone))).toEqual([STEMS]);
  });

  it('never reports a row that has no audio paths', async () => {
    const empty = [{ row: STEMS, audioPaths: [] }];
    expect(await findMissingRows(deps([], empty))).toEqual([]);
  });
});

describe('removeMissingRows', () => {
  it('deletes only the rows whose files are missing', async () => {
    const source = deps(['songs/a/Everlong.mp3']);
    await removeMissingRows(source);
    expect(source.deleteRow).toHaveBeenCalledTimes(1);
    expect(source.deleteRow).toHaveBeenCalledWith(SONG);
  });

  it('checks the disk again rather than trusting an earlier count', async () => {
    const source = deps([]);
    await removeMissingRows(source);
    expect(source.missingFiles).toHaveBeenCalledTimes(1);
    expect(source.deleteRow).not.toHaveBeenCalled();
  });
});
