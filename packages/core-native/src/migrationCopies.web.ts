import type * as Native from './migrationCopies.ts';

const NO_FILES = 'Database copies need the Android app';

export const databaseFreeBytes: typeof Native.databaseFreeBytes = () => 0;

export const removeDatabaseCopy: typeof Native.removeDatabaseCopy = () => {
  throw new Error(NO_FILES);
};

export const replaceDatabaseCopy: typeof Native.replaceDatabaseCopy = () => {
  throw new Error(NO_FILES);
};
