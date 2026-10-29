import { describe, expect, it } from 'vitest';

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

  it('names an untitled song by its job', () => {
    const imported = { ...importedBundle('stems/j'), title: '' };
    expect(newStemBundle(imported, 'u').title).toBe(imported.jobId);
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
