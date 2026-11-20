import { DatabaseSync } from 'node:sqlite';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import { throwsOpenError } from './database-open-error.test-helper';
import {
  migrate,
  OLDEST_UPGRADABLE_VERSION,
  SCHEMA_VERSION,
  V23_SCHEMA_VERSION,
  V24_SCHEMA_VERSION,
} from './migrate';
import { buildV24Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import {
  copyBeforeMigration,
  databaseBytes,
  MIGRATION_COPY_MARGIN_BYTES,
  migrationCopyName,
  PART_SUFFIX,
  type MigrationCopyFiles,
} from './migration-copy';
import { folderMigrationCopyFiles } from './migration-copy-files.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const FIXTURE_NAME = 'kitbag';
const LEGACY_VERSION = OLDEST_UPGRADABLE_VERSION - 1;
const PROBE_KEY = 'written-just-before-the-copy';
const PREVIOUS_COPY = 'the previous copy';
const LEFTOVER_PART_BYTES = 1024 * 1024;
const LATEST_COPY = migrationCopyName(FIXTURE_NAME, V24_SCHEMA_VERSION);

let folder: string;
let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'kitbag-migration-copy-'));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  rmSync(folder, { recursive: true, force: true });
});

const databasePath = () => join(folder, FIXTURE_NAME);
const filesInFolder = () => readdirSync(folder).sort();

function openV24(): DatabaseSync {
  const fixture = buildV24Fixture();
  fixture.exec(`VACUUM INTO '${databasePath()}'`);
  fixture.close();
  return new DatabaseSync(databasePath());
}

function openAtVersion(version: number): DatabaseSync {
  const database = new DatabaseSync(databasePath());
  database.exec(`PRAGMA user_version = ${String(version)}`);
  return database;
}

function nodeCopySql(database: DatabaseSync) {
  return {
    exec: (sql: string) => {
      database.exec(sql);
    },
    value: (sql: string) => {
      const row = database.prepare(sql).get();
      return row === undefined ? undefined : Object.values(row)[0];
    },
  };
}

function migrateWithCopy(
  database: DatabaseSync,
  files: MigrationCopyFiles = folderMigrationCopyFiles(folder),
) {
  migrate(nodeSqliteDriver(database), (fromVersion) => {
    copyBeforeMigration(nodeCopySql(database), files, fromVersion);
  });
}

const warnedAbout = (problem: string) =>
  warn.mock.calls.some(([message]) => String(message).includes(problem));

function writePreviousCopy(version: number) {
  writeFileSync(
    join(folder, migrationCopyName(FIXTURE_NAME, version)),
    PREVIOUS_COPY,
  );
}

const readCopy = (version: number) =>
  readFileSync(join(folder, migrationCopyName(FIXTURE_NAME, version)), 'utf8');

describe('the copy taken before a migration', () => {
  it('holds the database as it was, including a row written just before it', () => {
    const database = openV24();
    database.exec(
      `INSERT INTO preferences (key, value) VALUES ('${PROBE_KEY}', 'kept')`,
    );

    migrateWithCopy(database);

    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(filesInFolder()).toEqual([FIXTURE_NAME, LATEST_COPY]);
    const copy = new DatabaseSync(join(folder, LATEST_COPY));
    expect(pragma(copy, 'user_version')).toBe(V24_SCHEMA_VERSION);
    expect(
      rows(copy, `SELECT value FROM preferences WHERE key = '${PROBE_KEY}'`),
    ).toEqual([{ value: 'kept' }]);
    copy.close();
    expect(warn).not.toHaveBeenCalled();
  });

  it('is not taken for a new database', () => {
    const database = new DatabaseSync(databasePath());
    migrateWithCopy(database);
    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(filesInFolder()).toEqual([FIXTURE_NAME]);
  });

  it('is not taken for a database already on the current schema', () => {
    const database = openAtVersion(SCHEMA_VERSION);
    migrateWithCopy(database);
    expect(filesInFolder()).toEqual([FIXTURE_NAME]);
  });

  it.each([
    ['newer-version', SCHEMA_VERSION + 1],
    ['legacy-version', LEGACY_VERSION],
  ] as const)('is never taken for a refused (%s) database', (kind, version) => {
    const database = openAtVersion(version);
    const before = readFileSync(databasePath());
    const beforeUpgrade = vi.fn();

    throwsOpenError(kind, () => {
      migrate(nodeSqliteDriver(database), beforeUpgrade);
    });
    throwsOpenError(kind, () => {
      migrateWithCopy(database);
    });

    expect(beforeUpgrade).not.toHaveBeenCalled();
    expect(filesInFolder()).toEqual([FIXTURE_NAME]);
    expect(readFileSync(databasePath())).toEqual(before);
  });

  it('is skipped, and the migration still runs, when space is short', () => {
    const database = openV24();
    const needed =
      databaseBytes(nodeCopySql(database)) + MIGRATION_COPY_MARGIN_BYTES;

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, { freeBytes: () => needed - 1 }),
    );

    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(filesInFolder()).toEqual([FIXTURE_NAME]);
    expect(warnedAbout('no-space')).toBe(true);
  });

  it('is taken when the free space exactly covers it', () => {
    const database = openV24();
    const needed =
      databaseBytes(nodeCopySql(database)) + MIGRATION_COPY_MARGIN_BYTES;

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, { freeBytes: () => needed }),
    );

    expect(filesInFolder()).toEqual([FIXTURE_NAME, LATEST_COPY]);
  });

  it('does not block the migration when it fails, and names the failure', () => {
    const database = openV24();

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, {
        freeBytes: () => {
          throw new Error('statfs failed');
        },
      }),
    );

    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(warnedAbout('copy-failed')).toBe(true);
    expect(warnedAbout('no-space')).toBe(false);
  });

  it('counts a free space that could not be measured as a failed copy', () => {
    const database = openV24();

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, { freeBytes: () => Number.NaN }),
    );

    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(filesInFolder()).toEqual([FIXTURE_NAME]);
    expect(warnedAbout('copy-failed')).toBe(true);
    expect(warnedAbout('no-space')).toBe(false);
  });

  it('counts the space a leftover part frees before deciding there is no room', () => {
    const database = openV24();
    const needed =
      databaseBytes(nodeCopySql(database)) + MIGRATION_COPY_MARGIN_BYTES;
    const leftover = join(folder, LATEST_COPY + PART_SUFFIX);
    writeFileSync(leftover, Buffer.alloc(LEFTOVER_PART_BYTES));
    const freeWithoutLeftover = needed - LEFTOVER_PART_BYTES;

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, {
        freeBytes: () =>
          existsSync(leftover)
            ? freeWithoutLeftover
            : freeWithoutLeftover + LEFTOVER_PART_BYTES,
      }),
    );

    expect(filesInFolder()).toEqual([FIXTURE_NAME, LATEST_COPY]);
    expect(warnedAbout('no-space')).toBe(false);
  });

  it('leaves the previous copies untouched when it cannot be moved into place', () => {
    writePreviousCopy(V23_SCHEMA_VERSION);
    writePreviousCopy(V24_SCHEMA_VERSION);
    const database = openV24();

    migrateWithCopy(
      database,
      folderMigrationCopyFiles(folder, {
        replace: () => {
          throw new Error('rename failed');
        },
      }),
    );

    expect(pragma(database, 'user_version')).toBe(SCHEMA_VERSION);
    expect(readCopy(V23_SCHEMA_VERSION)).toBe(PREVIOUS_COPY);
    expect(readCopy(V24_SCHEMA_VERSION)).toBe(PREVIOUS_COPY);
    expect(filesInFolder()).toEqual([
      FIXTURE_NAME,
      migrationCopyName(FIXTURE_NAME, V23_SCHEMA_VERSION),
      LATEST_COPY,
    ]);
    expect(warnedAbout('copy-failed')).toBe(true);
  });

  it('replaces a part left behind by an interrupted copy', () => {
    writeFileSync(join(folder, LATEST_COPY + PART_SUFFIX), 'half a copy');
    const database = openV24();

    migrateWithCopy(database);

    expect(filesInFolder()).toEqual([FIXTURE_NAME, LATEST_COPY]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is the only copy kept', () => {
    writePreviousCopy(OLDEST_UPGRADABLE_VERSION);
    writePreviousCopy(V23_SCHEMA_VERSION);
    const database = openV24();

    migrateWithCopy(database);

    expect(filesInFolder()).toEqual([FIXTURE_NAME, LATEST_COPY]);
  });
});
