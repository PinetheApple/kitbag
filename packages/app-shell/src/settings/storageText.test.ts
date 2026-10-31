import type { StorageReport } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  databaseText,
  libraryAudioText,
  removeMissingLabel,
  removeMissingTitle,
  stemSetsText,
  storageSummary,
} from './storageText.ts';

const REPORT: StorageReport = {
  libraryAudio: { songs: 18, bytes: 840_000_000 },
  stemSets: { count: 1, bytes: 320_000_000 },
  database: { bytes: 1_200_000 },
  location: '/storage/emulated/0/Android/data/app.kitbag/files',
};

describe('storage text', () => {
  it('sums every byte and counts songs and stem sets as files', () => {
    expect(storageSummary(REPORT)).toBe('1.2 GB · 19 files');
  });

  it('counts the database in the total and says one file', () => {
    const one = {
      ...REPORT,
      libraryAudio: { songs: 1, bytes: 300_000 },
      stemSets: { count: 0, bytes: 0 },
    };
    expect(storageSummary(one)).toBe('1.5 MB · 1 file');
  });

  it('reads the rows as the sheet draws them', () => {
    expect(libraryAudioText(REPORT)).toBe('18 files · 840 MB');
    expect(stemSetsText(REPORT)).toBe('1 · 320 MB');
    expect(databaseText(REPORT)).toBe('1.2 MB');
  });
});

describe('removeMissingLabel', () => {
  it('names the count of rows it would remove', () => {
    expect(removeMissingLabel(2)).toBe('Remove missing files (2)');
  });

  it('asks about one song or several', () => {
    expect(removeMissingTitle(1)).toBe('Remove 1 missing song?');
    expect(removeMissingTitle(3)).toBe('Remove 3 missing songs?');
  });
});
