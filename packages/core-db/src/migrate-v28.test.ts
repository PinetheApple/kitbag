import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV27Fixture,
  pragma,
  rows,
  V28_SONG_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
    ({ name }) => name,
  );

describe('migrate v27 to v28', () => {
  it('gives every existing song full speed and keeps the rest', () => {
    const db = buildV27Fixture();
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM songs ORDER BY id',
    );
    expect(before).not.toHaveLength(0);
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM songs ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, ...V28_SONG_COLUMNS })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives a fresh database the column on songs', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(columns(db, 'songs')).toEqual(
      expect.arrayContaining(Object.keys(V28_SONG_COLUMNS)),
    );
  });
});
