import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { CLICK_RATE } from './click-rate';
import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV21Fixture,
  buildV22Fixture,
  pragma,
  rows,
  V22_TEMPO_COLUMNS,
  V27_STEM_SET_COLUMNS,
  V32_MANUAL_TEMPO_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
    ({ name }) => name,
  );

describe('migrate v21 to v22', () => {
  it('gives every existing stem song no bundle tempo and no chosen mode', () => {
    const db = buildV21Fixture();
    db.exec(`INSERT INTO stem_sets (name, created_at, uuid, bpm, click_rate)
      VALUES ('Redbone', 1700000000, 'uuid-r', 80.5, '${CLICK_RATE.half}')`);
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM stem_sets ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM stem_sets ORDER BY id')).toEqual(
      before.map((row) => ({
        ...row,
        ...V22_TEMPO_COLUMNS,
        ...V27_STEM_SET_COLUMNS,
        ...V32_MANUAL_TEMPO_COLUMNS,
      })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives a fresh database the tempo columns on stem songs', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(columns(db, 'stem_sets')).toEqual(
      expect.arrayContaining(Object.keys(V22_TEMPO_COLUMNS)),
    );
  });

  it('adds the tempo columns to stem songs only', () => {
    const db = buildV22Fixture();
    expect(columns(db, 'stem_sets')).toEqual(
      expect.arrayContaining(Object.keys(V22_TEMPO_COLUMNS)),
    );
    expect(columns(db, 'songs')).not.toContain('tempo_mode');
  });
});
