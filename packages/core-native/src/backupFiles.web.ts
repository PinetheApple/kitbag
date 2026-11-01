import type * as Native from './backupFiles.ts';

export const BACKUP_FILES_AVAILABLE = false;

export const pickBackup: typeof Native.pickBackup = () => Promise.resolve(null);

export const shareBackup: typeof Native.shareBackup = () =>
  Promise.reject(new Error('Sharing a backup needs the Android app'));
