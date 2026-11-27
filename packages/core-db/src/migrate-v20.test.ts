import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV19Fixture,
  pragma,
  rows,
  V20_SONG_COLUMNS,
  V24_SONG_COLUMNS,
  V28_SONG_COLUMNS,
  V30_SONG_COLUMNS,
  V32_MANUAL_TEMPO_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const OVERRIDE_COLUMNS = ['meter_beats_per_bar', 'bar_one_seconds'];

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
    ({ name }) => name,
  );

describe('migrate v19 to v20', () => {
  it('reads every existing song as an unversioned analysis with no meter override', () => {
    const db = buildV19Fixture();
    db.exec(`INSERT INTO songs
      (title, artist, file_path, duration, format, created_at, uuid, analysis_status, beat_grid)
      VALUES ('Waltz', 'Someone', 'songs/w/waltz.flac', 180, 'flac', 1700000000, 'uuid-w', 'done', X'0000003F')`);
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM songs ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM songs ORDER BY id')).toEqual(
      before.map((row) => ({
        ...row,
        ...V20_SONG_COLUMNS,
        ...V24_SONG_COLUMNS,
        ...V28_SONG_COLUMNS,
        ...V30_SONG_COLUMNS,
        ...V32_MANUAL_TEMPO_COLUMNS,
      })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('gives every existing stem song no meter override and no analysis version', () => {
    const db = buildV19Fixture();
    db.exec(`INSERT INTO stem_sets (name, created_at, uuid)
      VALUES ('Redbone', 1700000000, 'uuid-r')`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows(
        db,
        'SELECT name, meter_beats_per_bar, bar_one_seconds FROM stem_sets',
      ),
    ).toEqual([
      { name: 'Redbone', meter_beats_per_bar: null, bar_one_seconds: null },
    ]);
    expect(columns(db, 'stem_sets')).not.toContain('analysis_version');
  });

  it('gives a fresh database the override columns on both tables and the version on songs', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(columns(db, 'songs')).toEqual(
      expect.arrayContaining([...OVERRIDE_COLUMNS, 'analysis_version']),
    );
    expect(columns(db, 'stem_sets')).toEqual(
      expect.arrayContaining(OVERRIDE_COLUMNS),
    );
  });
});
