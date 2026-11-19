import type * as Native from './backupFiles.ts';

export const backupFilesAvailable: typeof Native.backupFilesAvailable = () =>
  false;

export const pickBackup: typeof Native.pickBackup = () => Promise.resolve(null);

export const saveBackup: typeof Native.saveBackup = () =>
  Promise.reject(new Error('Saving a backup needs the Android app'));

export const saveDatabaseCopy: typeof Native.saveDatabaseCopy = () =>
  Promise.reject(new Error('Saving a database copy needs the Android app'));

export const shareBackup: typeof Native.shareBackup = () =>
  Promise.reject(new Error('Sharing a backup needs the Android app'));
