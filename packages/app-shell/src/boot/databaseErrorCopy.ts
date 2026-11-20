import {
  SQLITE_FULL,
  SQLITE_READONLY,
  sqliteResultCode,
  type DatabaseOpenError,
} from '@kitbag/core-db';
import type { IconName } from '@kitbag/core-design';

export type DatabaseErrorFrame =
  'newer' | 'migration' | 'storageFull' | 'storageReadOnly' | 'open';

export interface DatabaseErrorCopy {
  readonly icon: IconName;
  readonly title: string;
  readonly reason: string;
}

export const DATABASE_ERROR_COPY: Readonly<
  Record<DatabaseErrorFrame, DatabaseErrorCopy>
> = {
  newer: {
    icon: 'storage',
    title: 'Your data is from a newer Kitbag',
    reason:
      'Your songs, setlists and settings were saved by a newer version of Kitbag. Update Kitbag to open them. Nothing has been changed.',
  },
  migration: {
    icon: 'error',
    title: 'Kitbag couldn’t update your data',
    reason:
      'Getting your songs, setlists and settings ready for this version didn’t finish. Nothing has been changed. Try again.',
  },
  storageFull: {
    icon: 'warning',
    title: 'Your phone is out of space',
    reason:
      'Kitbag needs a little free space to open your songs, setlists and settings. Free up some space, then try again. Nothing has been changed.',
  },
  storageReadOnly: {
    icon: 'warning',
    title: 'Kitbag can’t save to this phone’s storage',
    reason:
      'Your phone isn’t letting Kitbag save changes right now. Try again in a moment. Nothing has been changed.',
  },
  open: {
    icon: 'error',
    title: 'Kitbag couldn’t open your data',
    reason:
      'Your songs, setlists and settings couldn’t be read. Nothing has been changed. Try again.',
  },
};

export const DATABASE_ERROR_TEXT = {
  retry: 'Try again',
  saveCopy: 'Save a copy',
  saveHint:
    'Save a copy puts your song list, setlists and settings in a file you choose.',
  opening: 'Opening your data',
  stillFailing: 'Still couldn’t open it. Nothing has been changed.',
  copySaved: 'Copy saved.',
  copyFailed: 'Couldn’t save the copy. Try another place.',
  copyNoSpace:
    'There isn’t enough free space to make a complete copy. Free up some space, then try again.',
  copyUnreadable: 'Your data couldn’t be read, so no copy was saved.',
  relaunchFailed:
    'Your data opened, but Kitbag couldn’t restart. Close Kitbag and open it again.',
} as const;

const COPY_NAME_PREFIX = 'Kitbag data';
const COPY_EXTENSION = '.db';
const DATE_PART_DIGITS = 2;
const MONTH_INDEX_OFFSET = 1;

function storageFrame(cause: unknown): DatabaseErrorFrame {
  const code = sqliteResultCode(cause);
  if (code === SQLITE_FULL) return 'storageFull';
  if (code === SQLITE_READONLY) return 'storageReadOnly';
  return 'open';
}

export function databaseErrorFrame(
  error: Pick<DatabaseOpenError, 'kind' | 'cause'>,
): DatabaseErrorFrame {
  switch (error.kind) {
    case 'newer-version':
      return 'newer';
    case 'migration':
      return 'migration';
    case 'storage':
      return storageFrame(error.cause);
    case 'legacy-version':
    case 'foreign-keys':
    case 'open':
      return 'open';
  }
}

export function offersRetry(frame: DatabaseErrorFrame): boolean {
  return frame !== 'newer';
}

function datePart(value: number): string {
  return String(value).padStart(DATE_PART_DIGITS, '0');
}

export function databaseCopyName(now: Date): string {
  const day = [
    String(now.getFullYear()),
    datePart(now.getMonth() + MONTH_INDEX_OFFSET),
    datePart(now.getDate()),
  ].join('-');
  return `${COPY_NAME_PREFIX} ${day}${COPY_EXTENSION}`;
}
