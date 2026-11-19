import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV23Fixture,
  pragma,
  rows,
  V24_SONG_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
    ({ name }) => name,
  );

describe('migrate v23 to v24', () => {
  it('gives every existing song no tempo correction and keeps the rest', () => {
    const db = buildV23Fixture();
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM songs ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM songs ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, ...V24_SONG_COLUMNS })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives a fresh database the column on songs only', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(columns(db, 'songs')).toEqual(
      expect.arrayContaining(Object.keys(V24_SONG_COLUMNS)),
    );
    expect(columns(db, 'stem_sets')).not.toContain('tempo_correction');
  });
});
