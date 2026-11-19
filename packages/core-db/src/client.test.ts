import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  close: vi.fn(),
  executeSync: vi.fn(),
}));
const open = vi.hoisted(() => vi.fn());

vi.mock('@op-engineering/op-sqlite', () => ({ open }));

import { openDatabase } from './client';
import { memoryClickSoundFiles } from './click-sound-files.test-helper';
import { SCHEMA_VERSION } from './migrate';

const MIGRATION_FAILURE = new Error('disk I/O error');
const SQLITE_CANTOPEN = 14;

function openError(name: string) {
  try {
    openDatabase(memoryClickSoundFiles().files, name);
  } catch (error) {
    return error;
  }
  throw new Error('expected openDatabase to throw');
}

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
    expect(openError('failing')).toMatchObject({
      name: 'DatabaseOpenError',
      kind: 'migration',
      cause: MIGRATION_FAILURE,
    });
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('reports the migration error even if closing also fails', () => {
    connection.close.mockImplementation(() => {
      throw new Error('close failed');
    });
    expect(openError('failing')).toMatchObject({
      kind: 'migration',
      cause: MIGRATION_FAILURE,
    });
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
    expect(openError('unreachable')).toMatchObject({
      name: 'DatabaseOpenError',
      kind: 'open',
      cause: failure,
    });
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('reports an open refused by storage as a storage failure', () => {
    const failure = Object.assign(new Error('unable to open database file'), {
      code: SQLITE_CANTOPEN,
      extendedCode: SQLITE_CANTOPEN,
    });
    open.mockImplementation(() => {
      throw failure;
    });
    expect(openError('unwritable')).toMatchObject({
      kind: 'storage',
      cause: failure,
    });
  });

  it('refuses a newer schema without writing, and closes the connection', () => {
    connection.executeSync.mockImplementation(() => ({
      rows: [{ user_version: SCHEMA_VERSION + 1 }],
    }));
    expect(openError('newer')).toMatchObject({
      kind: 'newer-version',
      fromVersion: SCHEMA_VERSION + 1,
    });
    expect(connection.executeSync.mock.calls).toEqual([
      ['PRAGMA user_version'],
    ]);
    expect(connection.close).toHaveBeenCalledOnce();
  });
});
