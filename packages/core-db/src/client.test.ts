import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  close: vi.fn(),
  executeSync: vi.fn(),
}));

vi.mock('@op-engineering/op-sqlite', () => ({ open: () => connection }));

import { openDatabase } from './client';

const MIGRATION_FAILURE = new Error('disk I/O error');

beforeEach(() => {
  connection.close.mockReset();
  connection.executeSync.mockReset();
  connection.executeSync.mockImplementation((sql: string) => {
    if (sql === 'PRAGMA user_version') return { rows: [{ user_version: 0 }] };
    if (sql.startsWith('CREATE')) throw MIGRATION_FAILURE;
    return { rows: [] };
  });
});

describe('openDatabase', () => {
  it('closes the connection when the migration throws, then rethrows', () => {
    expect(() => openDatabase('failing')).toThrow(MIGRATION_FAILURE);
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('reports the migration error even if closing also fails', () => {
    connection.close.mockImplementation(() => {
      throw new Error('close failed');
    });
    expect(() => openDatabase('failing')).toThrow(MIGRATION_FAILURE);
  });

  it('leaves the connection open when the migration succeeds', () => {
    connection.executeSync.mockImplementation(() => ({
      rows: [{ user_version: 0 }],
    }));
    openDatabase('ok');
    expect(connection.close).not.toHaveBeenCalled();
  });
});
