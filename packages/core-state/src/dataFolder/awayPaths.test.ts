import { expect, it } from 'vitest';

import { songRow, stemsRow } from '../storage/fixtures.test-helper.ts';
import { awayPaths } from './awayPaths.ts';

it('collects every stored audio path once, songs and stems alike', () => {
  expect(
    awayPaths([
      { row: songRow(), audioPaths: ['songs/b/Everlong.mp3'] },
      {
        row: stemsRow(),
        audioPaths: ['stems/r/drums.flac', 'stems/r/bass.flac'],
      },
      { row: songRow({ id: 2 }), audioPaths: ['songs/b/Everlong.mp3'] },
      { row: stemsRow({ id: 2 }), audioPaths: [] },
    ]),
  ).toEqual([
    'songs/b/Everlong.mp3',
    'stems/r/bass.flac',
    'stems/r/drums.flac',
  ]);
});

it('collects nothing from an empty library', () => {
  expect(awayPaths([])).toEqual([]);
});
