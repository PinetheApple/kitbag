import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV20Fixture,
  pragma,
  rows,
  V21_CLICK_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

describe('migrate v20 to v21', () => {
  it('gives every existing stem song no click grouping at the single rate', () => {
    const db = buildV20Fixture();
    db.exec(`INSERT INTO stem_sets (name, created_at, uuid, meter_beats_per_bar)
      VALUES ('Seven', 1700000000, 'uuid-s', 3)`);
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM stem_sets ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM stem_sets ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, ...V21_CLICK_COLUMNS })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives a fresh database the click columns on stem songs only', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    const columns = (table: string) =>
      rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
        ({ name }) => name,
      );
    expect(columns('stem_sets')).toEqual(
      expect.arrayContaining(Object.keys(V21_CLICK_COLUMNS)),
    );
    expect(columns('songs')).not.toContain('click_grouping');
  });
});
