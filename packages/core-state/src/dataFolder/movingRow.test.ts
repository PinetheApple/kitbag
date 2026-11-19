import type { MoveStatus } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { DATA_FOLDER_CODES } from './codes.test-helper.ts';
import { movingRowKey, rowMatchIndex } from './movingRow.ts';

const PHASES = DATA_FOLDER_CODES.movePhases;

const ROW_PATHS = new Map<string, readonly string[]>([
  ['song:1', ['songs/a1/Everlong.mp3']],
  ['song:2', ['songs/b2/Redbone.mp3']],
  ['stems:3', ['stems/job3/drums.ogg', 'stems/job3/bass.ogg']],
]);

const RUNNING: MoveStatus = {
  phase: PHASES.copying,
  sourceVolumeUuid: null,
  targetVolumeUuid: 'card',
  doneBytes: 10,
  totalBytes: 100,
  doneFiles: 1,
  totalFiles: 10,
  path: 'songs/b2/waveform.bin',
  running: true,
  switched: false,
  paused: false,
  awaitingRelease: false,
  error: null,
};

const moving = (
  fields: Partial<MoveStatus>,
  rowPaths: ReadonlyMap<string, readonly string[]> = ROW_PATHS,
) => movingRowKey({ ...RUNNING, ...fields }, PHASES, rowMatchIndex(rowPaths));

describe('movingRowKey', () => {
  it('names the row whose own folder holds the file being copied', () => {
    expect(moving({})).toBe('song:2');
  });

  it('finds a stem set by any file in its folder', () => {
    expect(moving({ path: 'stems/job3/vocals.ogg' })).toBe('stems:3');
  });

  it('never matches a folder that only shares a prefix', () => {
    expect(moving({ path: 'songs/a10/Other.mp3' })).toBeNull();
  });

  it('never lets a song stored flat claim every song beside it', () => {
    const flat = new Map([
      ['song:1', ['songs/Old.mp3']],
      ['song:2', ['songs/b2/Redbone.mp3']],
    ]);
    expect(moving({ path: 'songs/b2/Redbone.mp3' }, flat)).toBe('song:2');
    expect(moving({ path: 'songs/Old.mp3' }, flat)).toBe('song:1');
    expect(moving({ path: 'songs/other.bin' }, flat)).toBeNull();
  });

  it('matches songs sharing a folder by their own files only', () => {
    const shared = new Map([
      ['song:1', ['Music/a.mp3']],
      ['song:2', ['Music/b.mp3']],
    ]);
    expect(moving({ path: 'Music/b.mp3' }, shared)).toBe('song:2');
    expect(moving({ path: 'Music/cover.jpg' }, shared)).toBeNull();
  });

  it('takes the deepest folder a row owns', () => {
    const nested = new Map([
      ['song:1', ['songs/a1/Everlong.mp3']],
      ['song:2', ['songs/a1/live/Everlong.mp3']],
    ]);
    expect(moving({ path: 'songs/a1/live/wave.bin' }, nested)).toBe('song:2');
    expect(moving({ path: 'songs/a1/wave.bin' }, nested)).toBeNull();
  });

  it.each([['catching up', { phase: PHASES.catchUp }]])(
    'marks the row while %s',
    (_state, change) => {
      expect(moving(change)).toBe('song:2');
    },
  );

  it.each([
    ['verifying', { phase: PHASES.verifying }],
    ['paused', { running: false, paused: true }],
    ['switched', { switched: true }],
    ['between files', { path: null }],
  ])('marks nothing while %s', (_state, change) => {
    expect(moving(change)).toBeNull();
  });

  it('marks nothing with no move', () => {
    expect(movingRowKey(null, PHASES, rowMatchIndex(ROW_PATHS))).toBeNull();
  });
});
