import { configureSongLibrary, songLibraryStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const library = vi.hoisted(() => ({
  list: vi.fn(),
  listSongFiles: vi.fn(),
  listStemFiles: vi.fn(),
  deleteSong: vi.fn<(id: number) => Promise<undefined>>(),
  report: { location: '/files' },
}));

vi.mock('../runtime/database.ts', () => ({
  getDatabase: () => ({ songLibrary: library }),
}));

vi.mock('@kitbag/core-native', async (actual) => ({
  ...(await actual<typeof import('@kitbag/core-native')>()),
  storageReport: (name: string) => Promise.resolve({ ...library.report, name }),
  missingFiles: (paths: readonly string[]) => Promise.resolve(paths),
}));

const SONG = {
  kind: 'song',
  id: 1,
  title: 'Everlong',
  createdAt: new Date(0),
} as const;

configureSongLibrary({
  records: {
    list: () => Promise.resolve([]),
    deleteSong: (id: number) => library.deleteSong(id),
  },
  files: {
    constants: () => {
      throw new Error('no native library');
    },
    cancelAnalysis: () => undefined,
  },
} as unknown as Parameters<typeof configureSongLibrary>[0]);

library.list.mockResolvedValue([SONG]);
library.listSongFiles.mockResolvedValue([{ id: 1, filePath: 'songs/a.mp3' }]);
library.listStemFiles.mockResolvedValue([]);

describe('storageDeps', () => {
  it('reads the report for the app database', async () => {
    const { storageDeps } = await import('./storageRuntime.ts');
    expect(await storageDeps.readReport()).toMatchObject({ name: 'kitbag' });
  });

  it('finds a song whose stored file is gone', async () => {
    const { storageDeps } = await import('./storageRuntime.ts');
    expect(await storageDeps.findMissing()).toEqual([SONG]);
  });

  it('deletes through the song library and clears its failure notice', async () => {
    library.deleteSong.mockRejectedValueOnce(new Error('locked'));
    const { storageDeps } = await import('./storageRuntime.ts');
    await storageDeps.removeMissing();
    expect(library.deleteSong).toHaveBeenCalledWith(1);
    expect(songLibraryStore.getState().notice).toBeNull();
  });

  it('leaves an unrelated library notice alone', async () => {
    songLibraryStore.setState({ notice: { kind: 'pickerFailed' } });
    library.deleteSong.mockResolvedValueOnce(undefined);
    const { storageDeps } = await import('./storageRuntime.ts');
    await storageDeps.removeMissing();
    expect(songLibraryStore.getState().notice).toEqual({
      kind: 'pickerFailed',
    });
  });
});
