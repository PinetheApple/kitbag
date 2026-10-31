import { beforeEach, expect, it, vi } from 'vitest';

import type { StorageReport } from './NativeKitbagLibrary';

const report: StorageReport = {
  libraryAudio: { files: 18, bytes: 840_000_000 },
  stemSets: { count: 1, bytes: 320_000_000 },
  database: { bytes: 1_200_000 },
  location: '/data/user/0/app/files/library',
};

const library = vi.hoisted(() => ({
  storageReport: vi.fn(),
  missingFiles: vi.fn(),
}));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const { missingFiles, storageReport } = await import('./libraryStorage.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

it('asks native for the named database and returns its report unchanged', async () => {
  library.storageReport.mockResolvedValue(report);

  await expect(storageReport('kitbag')).resolves.toBe(report);
  expect(library.storageReport).toHaveBeenCalledExactlyOnceWith('kitbag');
});

it('returns the subset native reports missing', async () => {
  const paths = ['songs/a/x.mp3', 'songs/b/y.mp3'];
  library.missingFiles.mockResolvedValue(['songs/b/y.mp3']);

  await expect(missingFiles(paths)).resolves.toEqual(['songs/b/y.mp3']);
  expect(library.missingFiles).toHaveBeenCalledExactlyOnceWith(paths);
});
