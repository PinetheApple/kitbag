import { beforeEach, expect, it, vi } from 'vitest';

const library = vi.hoisted(() => ({
  pickBackup: vi.fn(),
  shareBackup: vi.fn(),
  saveBackup: vi.fn(),
  saveDatabaseCopy: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const {
  backupFilesAvailable,
  pickBackup,
  saveBackup,
  saveDatabaseCopy,
  shareBackup,
} = await import('./backupFiles.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

it('is available on Android', () => {
  expect(backupFilesAvailable()).toBe(true);
});

it('hands back the picked file as native read it', async () => {
  const picked = { name: 'kitbag_export.json', bytes: 12, contents: '{}' };
  library.pickBackup.mockResolvedValue(picked);

  await expect(pickBackup()).resolves.toBe(picked);
});

it('reports a cancelled pick as null', async () => {
  library.pickBackup.mockResolvedValue(null);

  await expect(pickBackup()).resolves.toBeNull();
});

it('shares the contents under the given file name', async () => {
  library.shareBackup.mockResolvedValue(undefined);

  await shareBackup('kitbag_export.json', '{"a":1}');

  expect(library.shareBackup).toHaveBeenCalledExactlyOnceWith(
    'kitbag_export.json',
    '{"a":1}',
  );
});

it('saves the contents under the given file name and reports the outcome', async () => {
  library.saveBackup.mockResolvedValue(true);

  await expect(saveBackup('kitbag_export.json', '{"a":1}')).resolves.toBe(true);
  expect(library.saveBackup).toHaveBeenCalledExactlyOnceWith(
    'kitbag_export.json',
    '{"a":1}',
  );
});

it('reports a cancelled save dialog as not saved', async () => {
  library.saveBackup.mockResolvedValue(false);

  await expect(saveBackup('kitbag_export.json', '{}')).resolves.toBe(false);
});

it('saves a copy of the named database under the suggested file name', async () => {
  library.saveDatabaseCopy.mockResolvedValue(true);

  await expect(
    saveDatabaseCopy('kitbag', 'Kitbag data 2026-11-19.db'),
  ).resolves.toBe(true);
  expect(library.saveDatabaseCopy).toHaveBeenCalledExactlyOnceWith(
    'kitbag',
    'Kitbag data 2026-11-19.db',
  );
});

it('reports a cancelled database copy as not saved', async () => {
  library.saveDatabaseCopy.mockResolvedValue(false);

  await expect(
    saveDatabaseCopy('kitbag', 'Kitbag data 2026-11-19.db'),
  ).resolves.toBe(false);
});

it('passes a failed database copy on as a rejection', async () => {
  const failure = new Error('Could not save the backup');
  library.saveDatabaseCopy.mockRejectedValue(failure);

  await expect(
    saveDatabaseCopy('kitbag', 'Kitbag data 2026-11-19.db'),
  ).rejects.toBe(failure);
});
