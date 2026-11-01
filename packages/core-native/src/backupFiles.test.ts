import { beforeEach, expect, it, vi } from 'vitest';

const library = vi.hoisted(() => ({
  pickBackup: vi.fn(),
  shareBackup: vi.fn(),
}));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const { BACKUP_FILES_AVAILABLE, pickBackup, shareBackup } = await import(
  './backupFiles.ts'
);

beforeEach(() => {
  vi.clearAllMocks();
});

it('is available on a native build', () => {
  expect(BACKUP_FILES_AVAILABLE).toBe(true);
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
