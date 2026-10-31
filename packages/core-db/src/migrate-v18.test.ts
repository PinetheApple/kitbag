import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV17Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { REPAIR_POLY_AGAINST } from './preset-repair';
import {
  MAX_POLY_AGAINST,
  MIN_POLY_AGAINST,
  POLY_AGAINST_BAR,
} from './preset-rules';
import { nodeSqliteDriver } from './sqlite.test-helper';

const presets = (db: DatabaseSync) =>
  rows<Record<string, unknown>>(db, 'SELECT * FROM song_presets ORDER BY id');

describe('migrate v17 to v18', () => {
  it('keeps every preset and reads its poly cycle as the bar', () => {
    const db = buildV17Fixture();
    const before = presets(db);
    expect(before.map((row) => row.poly_beats)).toEqual([0, 5, 0, 16]);
    migrate(nodeSqliteDriver(db));
    expect(presets(db)).toEqual(
      before.map((row) => ({ ...row, poly_against: POLY_AGAINST_BAR })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });
});

describe('poly against repair', () => {
  it.each([
    [MIN_POLY_AGAINST - 2, POLY_AGAINST_BAR],
    [MAX_POLY_AGAINST + 1, POLY_AGAINST_BAR],
    [2.5, POLY_AGAINST_BAR],
    [POLY_AGAINST_BAR, POLY_AGAINST_BAR],
    [MIN_POLY_AGAINST, MIN_POLY_AGAINST],
    [MAX_POLY_AGAINST, MAX_POLY_AGAINST],
  ])('stores %s as %s', (stored, expected) => {
    const db = buildV17Fixture();
    migrate(nodeSqliteDriver(db));
    db.prepare('UPDATE song_presets SET poly_against = ? WHERE id = 1').run(
      stored,
    );
    db.exec(REPAIR_POLY_AGAINST);
    const [first] = presets(db);
    expect(first?.poly_against).toBe(expected);
  });
});
