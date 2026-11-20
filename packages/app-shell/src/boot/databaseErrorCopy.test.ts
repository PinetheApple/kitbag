import {
  DatabaseOpenError,
  SQLITE_CANTOPEN,
  SQLITE_FULL,
  SQLITE_READONLY,
  type DatabaseOpenErrorKind,
} from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  DATABASE_ERROR_COPY,
  databaseCopyName,
  databaseErrorFrame,
  type DatabaseErrorFrame,
} from './databaseErrorCopy.ts';

function sqliteError(code: number): Error {
  return Object.assign(new Error('sqlite'), { code });
}

function frameOf(kind: DatabaseOpenErrorKind, cause?: unknown) {
  return databaseErrorFrame(new DatabaseOpenError(kind, { cause }));
}

describe('databaseErrorFrame', () => {
  it.each<[DatabaseOpenErrorKind, DatabaseErrorFrame]>([
    ['newer-version', 'newer'],
    ['migration', 'migration'],
    ['legacy-version', 'open'],
    ['foreign-keys', 'open'],
    ['open', 'open'],
  ])('shows a %s failure as the %s frame', (kind, frame) => {
    expect(frameOf(kind)).toBe(frame);
  });

  it('names a full disk as out of space', () => {
    expect(frameOf('storage', sqliteError(SQLITE_FULL))).toBe('storageFull');
  });

  it('names read-only storage apart from a full disk', () => {
    expect(frameOf('storage', sqliteError(SQLITE_READONLY))).toBe(
      'storageReadOnly',
    );
  });

  it('does not guess a storage cause it cannot name', () => {
    expect(frameOf('storage', sqliteError(SQLITE_CANTOPEN))).toBe('open');
    expect(frameOf('storage')).toBe('open');
  });

  it('gives every frame its own title', () => {
    const titles = Object.values(DATABASE_ERROR_COPY).map((c) => c.title);

    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('databaseCopyName', () => {
  it('dates the copy by the local day', () => {
    expect(databaseCopyName(new Date(2026, 10, 19, 23, 59))).toBe(
      'Kitbag data 2026-11-19.db',
    );
  });

  it('pads single-digit months and days', () => {
    expect(databaseCopyName(new Date(2027, 0, 5))).toBe(
      'Kitbag data 2027-01-05.db',
    );
  });
});
