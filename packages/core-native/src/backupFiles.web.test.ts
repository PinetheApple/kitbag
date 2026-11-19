import { expect, it } from 'vitest';

import {
  backupFilesAvailable,
  pickBackup,
  saveBackup,
  saveDatabaseCopy,
  shareBackup,
} from './backupFiles.web.ts';

it('is unavailable on web', () => {
  expect(backupFilesAvailable()).toBe(false);
});

it('picks nothing and refuses to share or save', async () => {
  await expect(pickBackup()).resolves.toBeNull();
  await expect(shareBackup('kitbag_export.json', '{}')).rejects.toThrow();
  await expect(saveBackup('kitbag_export.json', '{}')).rejects.toThrow();
  await expect(saveDatabaseCopy('kitbag', 'copy.db')).rejects.toThrow();
});
