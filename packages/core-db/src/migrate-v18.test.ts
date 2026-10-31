import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV17Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { POLY_AGAINST_BAR } from './preset-rules';
import { songPresets } from './schema';
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

describe('poly against schema', () => {
  it('defaults a new row to the bar', () => {
    expect(songPresets.polyAgainst.default).toBe(POLY_AGAINST_BAR);
    expect(songPresets.polyAgainst.notNull).toBe(true);
  });
});
