import type { DataFolderVolume, DataFolderVolumes } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CARD, MB, move } from '../settings/dataFolderMove.test-helper.ts';
import { libraryStrip, type StripInput } from './libraryStrip.ts';

const ON_PHONE: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 0,
  volumes: [],
};

const RETURNED: DataFolderVolume = {
  volumeUuid: CARD,
  name: 'SanDisk SD card',
  state: 'mounted',
  inUse: false,
  freeBytes: 0,
  totalBytes: 0,
  awayFiles: 38,
  awayBytes: 840 * MB,
  awayRequiredBytes: 968 * MB,
  awaySongs: 12,
  awayStemSongs: 1,
};

const input = (fields: Partial<StripInput>): StripInput => ({
  move: null,
  volumes: ON_PHONE,
  unavailable: 0,
  view: 'songs',
  offered: null,
  sourceMissing: false,
  ...fields,
});

const RETURNING = move({
  sourceVolumeUuid: CARD,
  targetVolumeUuid: null,
  doneBytes: 320 * MB,
  totalBytes: 840 * MB,
  running: false,
  paused: true,
  cardReturn: true,
});

describe('the strip for a returned card', () => {
  it('offers the move for the card that is back', () => {
    expect(libraryStrip(input({ offered: RETURNED }))).toEqual({
      kind: 'returned',
      volumeUuid: CARD,
      title: 'SD card is back',
      detail: '12 songs on it · 840 MB',
    });
    expect(
      libraryStrip(input({ offered: RETURNED, view: 'stems' })),
    ).toMatchObject({ detail: '1 stem song on it · 840 MB' });
  });

  it('gives way to a move in progress', () => {
    expect(
      libraryStrip(input({ offered: RETURNED, move: RETURNING })).kind,
    ).toBe('move');
  });

  it('asks for the card on a paused return whose card is out', () => {
    expect(
      libraryStrip(input({ move: RETURNING, sourceMissing: true })),
    ).toEqual({
      kind: 'move',
      title: 'Move to internal storage paused',
      detail: '320 MB of 840 MB · put the card back',
      percent: 38,
    });
    expect(libraryStrip(input({ move: RETURNING }))).toMatchObject({
      detail: '320 MB of 840 MB · songs still play',
    });
  });
});
