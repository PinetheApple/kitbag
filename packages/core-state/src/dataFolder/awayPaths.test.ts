import { expect, it } from 'vitest';

import { songRow, stemsRow } from '../storage/fixtures.test-helper.ts';
import { awayPaths } from './awayPaths.ts';

it('collects every stored audio and waveform path once, songs and stems alike', () => {
  expect(
    awayPaths([
      {
        row: songRow(),
        audioPaths: ['songs/b/Everlong.mp3'],
        waveformPaths: ['songs/b/Everlong.kwav'],
      },
      {
        row: stemsRow(),
        audioPaths: ['stems/r/drums.flac', 'stems/r/bass.flac'],
        waveformPaths: ['stems/r/drums.kwav'],
      },
      { row: songRow({ id: 2 }), audioPaths: ['songs/b/Everlong.mp3'] },
      { row: stemsRow({ id: 2 }), audioPaths: [] },
    ]),
  ).toEqual([
    'songs/b/Everlong.kwav',
    'songs/b/Everlong.mp3',
    'stems/r/bass.flac',
    'stems/r/drums.flac',
    'stems/r/drums.kwav',
  ]);
});

it('collects nothing from an empty library', () => {
  expect(awayPaths([])).toEqual([]);
});
