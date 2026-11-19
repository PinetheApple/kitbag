import { bundleTempoOf, TEMPO_MODE, TEMPO_SOURCE } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import {
  errorCode,
  newStemBundle,
  stemFolderName,
  stemSetRemovals,
} from './stemBundleLogic.ts';
import { importedBundle } from './store.test-helper.ts';

describe('stemFolderName', () => {
  it.each([
    ['stems/abc', 'abc'],
    ['stems/abc-2', 'abc-2'],
    ['stems/abc/def', null],
    ['stems/', null],
    ['stems/.import-staging', null],
    ['songs/abc', null],
    ['stemsabc', null],
  ])('reads %s as %s', (dir, name) => {
    expect(stemFolderName(dir, 'stems')).toBe(name);
  });

  it('owns no folder without the native stems directory', () => {
    expect(stemFolderName('stems/abc', null)).toBeNull();
  });
});

describe('stemSetRemovals', () => {
  it('removes an owned folder whole and anything outside it file by file', () => {
    expect(
      stemSetRemovals(
        {
          folder: 'stems/abc',
          files: ['stems/abc/a.flac', 'stems/abc/a.kwav', 'elsewhere/b.flac'],
        },
        'stems',
      ),
    ).toEqual([
      { kind: 'stemFolder', name: 'abc' },
      { kind: 'file', path: 'elsewhere/b.flac' },
    ]);
  });

  it('removes a folder-less set file by file', () => {
    expect(
      stemSetRemovals({ folder: null, files: ['stems/x/a.flac'] }, 'stems'),
    ).toEqual([{ kind: 'file', path: 'stems/x/a.flac' }]);
  });
});

describe('newStemBundle', () => {
  it('stores no waveform for a stem without peaks', () => {
    const bundle = newStemBundle(importedBundle('stems/j'), 'u');
    expect(bundle.stems.map((stem) => stem.waveformPath)).toEqual([
      'stems/j/vocals.kwav',
      null,
    ]);
    expect(bundle).toMatchObject({ uuid: 'u', folder: 'stems/j' });
  });

  it('stores the bundle tempo it was handed', () => {
    const tempo = {
      mode: TEMPO_MODE.follow,
      bpm: 127.3,
      anchor: 0.42,
      beatsPerBar: 4,
      source: TEMPO_SOURCE.user,
    };
    const imported = { ...importedBundle('stems/j'), tempo };
    expect(newStemBundle(imported, 'u').tempo).toEqual(tempo);
    expect(newStemBundle(importedBundle('stems/j'), 'u').tempo).toBeNull();
  });

  it('stores no tempo for a mode the library does not know', () => {
    const imported = {
      ...importedBundle('stems/j'),
      tempo: {
        mode: 'steady',
        bpm: 120,
        anchor: 0,
        beatsPerBar: 4,
        source: 'detected',
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(newStemBundle(imported, 'u').tempo).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[kitbag] stem bundle tempo dropped',
      expect.stringContaining('steady'),
    );
    warn.mockRestore();
  });

  it('stores no tempo from a bridge too old to send one', () => {
    expect(importedBundle('stems/j')).not.toHaveProperty('tempo');
    expect(newStemBundle(importedBundle('stems/j'), 'u').tempo).toBeNull();
  });

  it('names an untitled song by its job', () => {
    const imported = { ...importedBundle('stems/j'), title: '' };
    expect(newStemBundle(imported, 'u').title).toBe(imported.jobId);
  });
});

describe("every tempo word StemDeck's tempo_grid.py writes", () => {
  it.each(
    ['constant', 'follow'].flatMap((mode) =>
      ['detected', 'user'].map((source) => [mode, source]),
    ),
  )('reads %s from %s', (mode, source) => {
    expect(
      bundleTempoOf({ mode, bpm: 120, anchor: 0, beatsPerBar: 4, source }),
    ).not.toBeNull();
  });

  it('reads a follow tempo with no detected bpm or anchor', () => {
    const untimed = {
      mode: 'follow',
      bpm: null,
      anchor: null,
      beatsPerBar: 4,
      source: 'detected',
    };
    const imported = { ...importedBundle('stems/j'), tempo: untimed };
    expect(newStemBundle(imported, 'u').tempo).toEqual(untimed);
  });
});

describe('errorCode', () => {
  it('reads a promise rejection code and nothing else', () => {
    expect(errorCode(Object.assign(new Error(), { code: 'no-space' }))).toBe(
      'no-space',
    );
    expect(errorCode(new Error('no-space'))).toBeNull();
    expect(errorCode('no-space')).toBeNull();
  });
});
