import type * as Native from './databaseGate.ts';

export const launchDatabaseError: typeof Native.launchDatabaseError = () =>
  undefined;

export const reopenDatabase: typeof Native.reopenDatabase = () =>
  Promise.resolve(undefined);

export const saveDatabaseCopyNotice: typeof Native.saveDatabaseCopyNotice =
  () => Promise.resolve(null);
