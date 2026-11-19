import { beforeEach, expect, it, vi } from 'vitest';

import type { StorageReport } from './NativeKitbagLibrary';

const report: StorageReport = {
  libraryAudio: { songs: 18, bytes: 840_000_000 },
  stemSets: { count: 1, bytes: 320_000_000 },
  database: { bytes: 1_200_000 },
  location: '/data/user/0/app/files/library',
};

const library = vi.hoisted(() => ({
  storageReport: vi.fn(),
  missingFiles: vi.fn(),
  onDataFolderChanged: vi.fn(),
}));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const { missingFiles, storageReport, watchDataFolder } =
  await import('./libraryStorage.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

it('asks native for the named database and returns its report unchanged', async () => {
  library.storageReport.mockResolvedValue(report);

  await expect(storageReport('kitbag')).resolves.toBe(report);
  expect(library.storageReport).toHaveBeenCalledExactlyOnceWith('kitbag');
});

it('returns what native reports missing and unavailable', async () => {
  const paths = ['songs/a/x.mp3', 'songs/b/y.mp3'];
  const availability = {
    missing: ['songs/b/y.mp3'],
    unavailable: ['songs/a/x.mp3'],
    rootAvailable: true,
  };
  library.missingFiles.mockResolvedValue(availability);

  await expect(missingFiles(paths)).resolves.toBe(availability);
  expect(library.missingFiles).toHaveBeenCalledExactlyOnceWith(paths);
});

it('stops hearing data folder changes once unwatched', () => {
  const remove = vi.fn();
  library.onDataFolderChanged.mockReturnValue({ remove });
  const listener = vi.fn();

  const stop = watchDataFolder(listener);
  expect(library.onDataFolderChanged).toHaveBeenCalledExactlyOnceWith(listener);
  stop();
  expect(remove).toHaveBeenCalledOnce();
});
