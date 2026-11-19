import type { MoveStatus } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { movingRowKey } from './movingRow.ts';

const ROW_PATHS = new Map<string, readonly string[]>([
  ['song:1', ['songs/a1/Everlong.mp3']],
  ['song:2', ['songs/b2/Redbone.mp3']],
  ['stems:3', ['stems/job3/drums.ogg', 'stems/job3/bass.ogg']],
]);

const RUNNING: MoveStatus = {
  phase: 'copying',
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

describe('movingRowKey', () => {
  it('names the row whose folder holds the file being copied', () => {
    expect(movingRowKey(RUNNING, ROW_PATHS)).toBe('song:2');
  });

  it('finds a stem set by any of its stems', () => {
    const move = { ...RUNNING, path: 'stems/job3/vocals.ogg' };
    expect(movingRowKey(move, ROW_PATHS)).toBe('stems:3');
  });

  it('never matches a folder that only shares a prefix', () => {
    const move = { ...RUNNING, path: 'songs/a10/Other.mp3' };
    expect(movingRowKey(move, ROW_PATHS)).toBeNull();
  });

  it.each([
    ['paused', { running: false, paused: true }],
    ['switched', { switched: true }],
    ['between files', { path: null }],
  ])('marks nothing while %s', (_state, change) => {
    expect(movingRowKey({ ...RUNNING, ...change }, ROW_PATHS)).toBeNull();
  });

  it('marks nothing with no move', () => {
    expect(movingRowKey(null, ROW_PATHS)).toBeNull();
  });
});
