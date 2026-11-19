import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV22Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const CLICK_SOUND_COLUMNS = [
  { name: 'slot', type: 'INTEGER', notnull: 0, pk: 1 },
  { name: 'uuid', type: 'TEXT', notnull: 1, pk: 0 },
  { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
  { name: 'file_name', type: 'TEXT', notnull: 1, pk: 0 },
];

const columns = (db: DatabaseSync) =>
  rows<{ name: string; type: string; notnull: number; pk: number }>(
    db,
    'PRAGMA table_info(click_sounds)',
  ).map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));

describe('migrate v22 to v23', () => {
  it('adds an empty click_sounds table and keeps every preset', () => {
    const db = buildV22Fixture();
    const before = rows(db, 'SELECT * FROM song_presets ORDER BY id');
    migrate(nodeSqliteDriver(db));
    expect(columns(db)).toEqual(CLICK_SOUND_COLUMNS);
    expect(rows(db, 'SELECT * FROM click_sounds')).toEqual([]);
    expect(rows(db, 'SELECT * FROM song_presets ORDER BY id')).toEqual(before);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives a fresh database the same table', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(columns(db)).toEqual(CLICK_SOUND_COLUMNS);
  });

  it('holds one sound per slot', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    const insert = `INSERT INTO click_sounds (slot, uuid, name, file_name)
      VALUES (0, 'u', 'Rimshot', 'a.wav')`;
    db.exec(insert);
    expect(() => {
      db.exec(insert);
    }).toThrow(/UNIQUE/);
  });
});
