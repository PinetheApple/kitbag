import { expect, it } from 'vitest';

import {
  backupFilesAvailable,
  pickBackup,
  shareBackup,
} from './backupFiles.web.ts';

it('is unavailable on web', () => {
  expect(backupFilesAvailable()).toBe(false);
});

it('picks nothing and refuses to share', async () => {
  await expect(pickBackup()).resolves.toBeNull();
  await expect(shareBackup('kitbag_export.json', '{}')).rejects.toThrow();
});
