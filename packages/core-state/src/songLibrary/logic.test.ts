import type { LibraryRow, LibrarySongRow } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  analysisFailure,
  audioFormat,
  filterRows,
  isLibraryChip,
  isStemArchive,
  songBadge,
  songRemovals,
  summarize,
} from './logic.ts';
import { CODES as SHARED_CODES } from './store.test-helper.ts';

const created = new Date(0);

function song(
  id: number,
  title: string,
  fields: Partial<LibrarySongRow> = {},
): LibrarySongRow {
  return {
    kind: 'song',
    id,
    title,
    artist: 'Foo Fighters',
    durationSec: 250,
    bpm: null,
    hasGrid: false,
    analysisStatus: 'pending',
    analysisError: null,
    inSetlist: false,
    createdAt: created,
    ...fields,
  };
}

const ROWS: readonly LibraryRow[] = [
  song(1, 'Everlong', {
    bpm: 158,
    hasGrid: true,
    analysisStatus: 'done',
    inSetlist: true,
  }),
  song(2, 'Take Five', { artist: 'Dave Brubeck' }),
  song(3, 'Drone', { analysisStatus: 'done' }),
  song(4, 'Broken', { analysisStatus: 'failed' }),
  song(5, 'Kept', { analysisStatus: 'failed', hasGrid: true, bpm: 90 }),
  {
    kind: 'stems',
    id: 1,
    title: 'Redbone',
    stemCount: 6,
    durationSec: 326,
    bpm: null,
    key: null,
    scale: null,
    hasGrid: false,
    createdAt: created,
  },
];

const titles = (rows: readonly LibraryRow[]) => rows.map((row) => row.title);

describe('filterRows', () => {
  it.each([
    ['all', ['Everlong', 'Take Five', 'Drone', 'Broken', 'Kept', 'Redbone']],
    ['analyzed', ['Everlong', 'Drone', 'Kept']],
    ['stems', ['Redbone']],
    ['setlists', ['Everlong']],
  ] as const)('the %s chip admits %j', (chip, expected) => {
    expect(titles(filterRows(ROWS, '', chip))).toEqual(expected);
  });

  it('searches title and artist, ignoring case and outer spaces', () => {
    expect(titles(filterRows(ROWS, '  brubeck ', 'all'))).toEqual([
      'Take Five',
    ]);
    expect(titles(filterRows(ROWS, 'RED', 'all'))).toEqual(['Redbone']);
    expect(titles(filterRows(ROWS, 'foo', 'all'))).toEqual([
      'Everlong',
      'Drone',
      'Broken',
      'Kept',
    ]);
  });

  it('applies search and chip together', () => {
    expect(titles(filterRows(ROWS, 'foo', 'analyzed'))).toEqual([
      'Everlong',
      'Drone',
      'Kept',
    ]);
    expect(titles(filterRows(ROWS, 'brubeck', 'stems'))).toEqual([]);
  });
});

describe('songBadge', () => {
  it.each([
    ['pending', false, 'pending'],
    ['analyzing', false, 'analyzing'],
    ['done', true, 'grid'],
    ['done', false, 'noGrid'],
    ['failed', true, 'grid'],
    ['failed', false, 'failed'],
  ] as const)(
    'a %s song (grid %s) shows %s',
    (analysisStatus, hasGrid, expected) => {
      expect(songBadge(song(7, 'X', { analysisStatus, hasGrid }))).toBe(
        expected,
      );
    },
  );
});

describe('summarize', () => {
  it('counts single-file songs, finished analyses and stem songs apart', () => {
    expect(summarize(ROWS)).toEqual({
      songCount: 5,
      analyzedCount: 3,
      stemSongCount: 1,
    });
  });
});

describe('import helpers', () => {
  it('recognises a stem archive by mime type or name', () => {
    expect(isStemArchive({ name: 'a.stemdeck.zip', mimeType: '' })).toBe(true);
    expect(
      isStemArchive({ name: 'a', mimeType: 'application/x-zip-compressed' }),
    ).toBe(true);
    expect(isStemArchive({ name: 'a.mp3', mimeType: 'audio/mpeg' })).toBe(
      false,
    );
  });

  it('reads the format from the stored file name', () => {
    expect(audioFormat('songs/abc/Everlong.MP3')).toBe('mp3');
    expect(audioFormat('songs/abc/.hidden')).toBe('');
    expect(audioFormat('songs/a.b/noext')).toBe('');
  });

  it('accepts only the four chips', () => {
    expect(isLibraryChip('stems')).toBe(true);
    expect(isLibraryChip('Stems')).toBe(false);
    expect(isLibraryChip(undefined)).toBe(false);
  });
});

const CODES = { ...SHARED_CODES, songsDir: 'tracks' };

describe('songRemovals', () => {
  const uuid = '0b8e2c6a-1f3d-4c5e-9a7b-2d4f6e8a0c1b';
  const dir = CODES.songsDir;

  it('removes an import’s own folder whole', () => {
    expect(
      songRemovals(
        {
          uuid,
          filePath: `${dir}/${uuid}/Everlong.mp3`,
          waveformPath: `${dir}/${uuid}/Everlong.kwav`,
        },
        dir,
      ),
    ).toEqual([{ kind: 'folder', name: uuid }]);
  });

  it('removes a file outside the folder on its own', () => {
    expect(
      songRemovals(
        {
          uuid,
          filePath: `${dir}/${uuid}/Everlong.mp3`,
          waveformPath: 'waveforms/Everlong.kwav',
        },
        dir,
      ),
    ).toEqual([
      { kind: 'folder', name: uuid },
      { kind: 'file', path: 'waveforms/Everlong.kwav' },
    ]);
  });

  it.each([
    ['another row’s folder', `${dir}/other-uuid/a.mp3`],
    ['a nested path', `${dir}/${uuid}/sub/a.mp3`],
    ['an older layout', 'music/a.mp3'],
    ['outside the songs directory', `songs/${uuid}/a.mp3`],
  ])('deletes only the files when the path is %s', (_case, filePath) => {
    expect(songRemovals({ uuid, filePath, waveformPath: null }, dir)).toEqual([
      { kind: 'file', path: filePath },
    ]);
  });

  it('never removes a folder named by an unsafe uuid', () => {
    expect(
      songRemovals(
        { uuid: '..', filePath: `${dir}/../a.mp3`, waveformPath: null },
        dir,
      ),
    ).toEqual([{ kind: 'file', path: `${dir}/../a.mp3` }]);
  });

  it('never removes a folder when the songs directory is unknown', () => {
    expect(
      songRemovals(
        { uuid, filePath: `${dir}/${uuid}/a.mp3`, waveformPath: null },
        null,
      ),
    ).toEqual([{ kind: 'file', path: `${dir}/${uuid}/a.mp3` }]);
  });
});

describe('analysisFailure', () => {
  const failed = (analysisError: string | null, hasGrid = false) =>
    song(1, 'X', { analysisStatus: 'failed', analysisError, hasGrid });

  it.each([
    ['missing-file', 'missingFile'],
    ['unsupported', 'unsupported'],
    ['interrupted', 'interrupted'],
    ['internal', 'other'],
    ['something native did not promise', 'other'],
  ] as const)('reads %s as %s', (error, kind) => {
    expect(analysisFailure(failed(error), CODES)).toEqual({
      kind,
      keptGrid: false,
    });
  });

  it('reads every failure as other without the native codes', () => {
    expect(analysisFailure(failed('missing-file'), null)?.kind).toBe('other');
  });

  it('reports a grid kept from before the failed re-analysis', () => {
    expect(analysisFailure(failed('internal', true), CODES)).toEqual({
      kind: 'other',
      keptGrid: true,
    });
  });

  it('is null for a song that did not fail', () => {
    expect(
      analysisFailure(song(1, 'X', { analysisStatus: 'done' }), CODES),
    ).toBeNull();
  });
});
