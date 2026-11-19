import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  close: vi.fn(),
  executeSync: vi.fn(),
}));
const open = vi.hoisted(() => vi.fn());

vi.mock('@op-engineering/op-sqlite', () => ({ open }));

import { openDatabase } from './client';
import { memoryClickSoundFiles } from './click-sound-files.test-helper';
import {
  opSqliteError,
  throwsOpenError,
} from './database-open-error.test-helper';
import { SCHEMA_VERSION } from './migrate';
import { SQLITE_CANTOPEN } from './sqlite-result-codes';

const MIGRATION_FAILURE = new Error('disk I/O error');

const openNamed = (name: string) => () =>
  openDatabase(memoryClickSoundFiles().files, name);

beforeEach(() => {
  open.mockReset();
  open.mockReturnValue(connection);
  connection.close.mockReset();
  connection.executeSync.mockReset();
  connection.executeSync.mockImplementation((sql: string) => {
    if (sql === 'PRAGMA user_version') return { rows: [{ user_version: 0 }] };
    if (sql.startsWith('CREATE')) throw MIGRATION_FAILURE;
    return { rows: [] };
  });
});

describe('openDatabase', () => {
  it('closes the connection when the migration throws, then reports it as the cause', () => {
    const error = throwsOpenError('migration', openNamed('failing'));
    expect(error.cause).toBe(MIGRATION_FAILURE);
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('reports the migration error even if closing also fails, keeping the close error', () => {
    const closeFailure = new Error('close failed');
    connection.close.mockImplementation(() => {
      throw closeFailure;
    });
    const error = throwsOpenError('migration', openNamed('failing'));
    expect(error.cause).toBe(MIGRATION_FAILURE);
    expect(error.cleanupErrors).toEqual([closeFailure]);
  });

  it('leaves the connection open when the migration succeeds', () => {
    connection.executeSync.mockImplementation(() => ({
      rows: [{ user_version: 0, foreign_keys: 1 }],
    }));
    openDatabase(memoryClickSoundFiles().files, 'ok');
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('reports a connection that cannot be made as an open failure, keeping its cause', () => {
    const failure = new Error('could not create the database directory');
    open.mockImplementation(() => {
      throw failure;
    });
    expect(throwsOpenError('open', openNamed('unreachable')).cause).toBe(
      failure,
    );
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('reports an open refused by storage as a storage failure', () => {
    const failure = opSqliteError(
      'unable to open database file',
      SQLITE_CANTOPEN,
    );
    open.mockImplementation(() => {
      throw failure;
    });
    expect(throwsOpenError('storage', openNamed('unwritable')).cause).toBe(
      failure,
    );
  });

  it('refuses a newer schema without writing, and closes the connection', () => {
    connection.executeSync.mockImplementation(() => ({
      rows: [{ user_version: SCHEMA_VERSION + 1 }],
    }));
    expect(
      throwsOpenError('newer-version', openNamed('newer')).fromVersion,
    ).toBe(SCHEMA_VERSION + 1);
    expect(connection.executeSync.mock.calls).toEqual([
      ['PRAGMA user_version'],
    ]);
    expect(connection.close).toHaveBeenCalledOnce();
  });
});
