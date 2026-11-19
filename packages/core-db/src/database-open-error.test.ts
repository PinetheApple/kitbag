import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseOpenError } from './database-open-error';
import {
  migrate,
  MIGRATE_V24_TO_V25,
  SCHEMA_VERSION,
  V24_SCHEMA_VERSION,
  type MigrationDriver,
} from './migrate';
import { buildV24Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const PRIMARY_RESULT_CODE_MASK = 0xff;
const SQLITE_FULL = 13;
const SQLITE_IOERR_FSYNC = 1034;
const SQLITE_CONSTRAINT_NOTNULL = 1299;
const SQLITE_NOTADB = 26;
const CORRUPT_FILE_BYTES = 200;
const GARBAGE_BYTE = 7;
const FAILING_V25_STATEMENT = MIGRATE_V24_TO_V25[2] ?? '';

function opSqliteError(message: string, extendedCode: number) {
  return Object.assign(new Error(message), {
    code: extendedCode & PRIMARY_RESULT_CODE_MASK,
    extendedCode,
  });
}

function openError(work: () => void): DatabaseOpenError {
  try {
    work();
  } catch (error) {
    if (error instanceof DatabaseOpenError) return error;
    throw error;
  }
  throw new Error('expected a DatabaseOpenError');
}

function failingAt(
  db: DatabaseSync,
  failOn: string,
  failure: unknown,
  { autoRollback = false } = {},
): MigrationDriver {
  const driver = nodeSqliteDriver(db);
  return {
    ...driver,
    exec: (sql) => {
      if (sql === failOn) {
        if (autoRollback) driver.exec('ROLLBACK');
        throw failure;
      }
      driver.exec(sql);
    },
  };
}

function snapshot(db: DatabaseSync) {
  return {
    userVersion: pragma(db, 'user_version'),
    schema: rows(db, 'SELECT type, name, sql FROM sqlite_master ORDER BY name'),
    setlistItems: rows(db, 'SELECT * FROM setlist_items ORDER BY id'),
  };
}

const scratch: string[] = [];

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true });
});

describe('migrate refuses what it cannot open', () => {
  it('refuses a newer schema before any statement, leaving the database as it was', () => {
    const db = buildV24Fixture();
    db.exec(`PRAGMA user_version = ${String(SCHEMA_VERSION + 1)}`);
    const before = snapshot(db);
    const driver = nodeSqliteDriver(db);
    const exec = vi.spyOn(driver, 'exec');
    const setUserVersion = vi.spyOn(driver, 'setUserVersion');
    const error = openError(() => {
      migrate(driver);
    });
    expect(error).toMatchObject({
      kind: 'newer-version',
      fromVersion: SCHEMA_VERSION + 1,
    });
    expect(exec).not.toHaveBeenCalled();
    expect(setUserVersion).not.toHaveBeenCalled();
    expect(snapshot(db)).toEqual(before);
  });

  it('reports a corrupt header as an open failure, keeping the SQLite error and the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitbag-db-'));
    scratch.push(dir);
    const path = join(dir, 'corrupt.db');
    writeFileSync(path, Buffer.alloc(CORRUPT_FILE_BYTES, GARBAGE_BYTE));
    const before = readFileSync(path);
    const db = new DatabaseSync(path);
    const error = openError(() => {
      migrate(nodeSqliteDriver(db));
    });
    db.close();
    expect(error.kind).toBe('open');
    expect(error.cause).toMatchObject({ errcode: SQLITE_NOTADB });
    expect(readFileSync(path)).toEqual(before);
  });
});

describe('a failed upgrade', () => {
  it('commits nothing and reports a migration failure from the version it started at', () => {
    const db = buildV24Fixture();
    const before = snapshot(db);
    const failure = opSqliteError('NOT NULL', SQLITE_CONSTRAINT_NOTNULL);
    const error = openError(() => {
      migrate(failingAt(db, FAILING_V25_STATEMENT, failure));
    });
    expect(error).toMatchObject({
      kind: 'migration',
      fromVersion: V24_SCHEMA_VERSION,
      cause: failure,
      cleanupErrors: [],
    });
    expect(snapshot(db)).toEqual(before);
  });

  it.each([
    ['disk full', SQLITE_FULL],
    ['an fsync I/O error', SQLITE_IOERR_FSYNC],
  ])(
    'keeps %s as the cause when SQLite already rolled back and ROLLBACK throws',
    (_, extendedCode) => {
      const db = buildV24Fixture();
      const failure = opSqliteError('storage', extendedCode);
      const error = openError(() => {
        migrate(
          failingAt(db, FAILING_V25_STATEMENT, failure, { autoRollback: true }),
        );
      });
      expect(error.kind).toBe('storage');
      expect(error.cause).toBe(failure);
      expect(error.cleanupErrors).toHaveLength(1);
      expect(String(error.cleanupErrors[0])).toMatch(/rollback/);
      expect(pragma(db, 'user_version')).toBe(V24_SCHEMA_VERSION);
    },
  );

  it('keeps the migration error when re-enabling foreign keys also fails', () => {
    const db = buildV24Fixture();
    const failure = opSqliteError('full', SQLITE_FULL);
    const pragmaFailure = new Error('pragma failed');
    const failing = failingAt(db, FAILING_V25_STATEMENT, failure);
    const driver: MigrationDriver = {
      ...failing,
      exec: (sql) => {
        if (sql === 'PRAGMA foreign_keys = ON') throw pragmaFailure;
        failing.exec(sql);
      },
    };
    const error = openError(() => {
      migrate(driver);
    });
    expect(error).toMatchObject({ kind: 'storage', cause: failure });
    expect(error.cleanupErrors).toEqual([pragmaFailure]);
  });
});
