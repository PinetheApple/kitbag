import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { MANUAL_TEMPO_COLUMN_DDL } from './migrate-manual-tempo';
import {
  buildV30Fixture,
  pragma,
  rows,
  V32_MANUAL_TEMPO_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

type Row = Record<string, unknown>;

const PRESETS = 'song_presets';

const LINKED_PRESET = `INSERT INTO song_presets
  (id, name, bpm, beats_per_bar, subdivision, denominator, accents, per_accent_sounds,
   poly_enabled, poly_beats, poly_against, sound, ramp_enabled, ramp_start_bpm, ramp_end_bpm,
   ramp_length, ramp_step, ramp_unit, ramp_loop, bar_mute_enabled, bar_mute_play_bars,
   bar_mute_mute_bars, count_in_bars, notes, phase_nudge, title, artist, source,
   length_seconds, library_song_id, uuid, poly_accents)
  VALUES (7, 'Linked — café', 123.456, 7, 3, 8, X'02010101010101', X'0105',
   1, 5, 3, 7, 1, 20, 400, 90, 4, 1, 1, 1, 2, 3, 2, 'line one
line two', -0.125, 'Song', 'Band', 'library', 245.5, 1, 'uuid-linked', X'0201010101')`;

const NULL_BPM_PRESET = `INSERT INTO song_presets
  (name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, uuid)
  VALUES ('Click only', NULL, 4, 1, X'02010101', 0, 0, 0, 'uuid-click-only')`;

function seededV30(): DatabaseSync {
  const db = buildV30Fixture();
  db.exec(LINKED_PRESET);
  db.exec(
    `INSERT INTO setlist_items (setlist_id, song_preset_id, position) VALUES (1, 7, 2)`,
  );
  db.exec(
    'INSERT INTO song_presets (name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, uuid) ' +
      "VALUES ('Deleted', 60, 1, 1, X'01', 0, 0, 0, 'uuid-deleted')",
  );
  db.exec("DELETE FROM song_presets WHERE name = 'Deleted'");
  return db;
}

const LATER_COLUMNS = new Set(Object.keys(V32_MANUAL_TEMPO_COLUMNS));

const withoutLaterColumns = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).filter(([column]) => !LATER_COLUMNS.has(column)),
  );

const withoutLaterDdl = (row: Row) =>
  typeof row.sql === 'string'
    ? {
        ...row,
        sql: MANUAL_TEMPO_COLUMN_DDL.reduce(
          (sql, ddl) => sql.replace(`, ${ddl}`, ''),
          row.sql,
        ),
      }
    : row;

const table = (db: DatabaseSync, name: string) =>
  rows<Row>(db, `SELECT * FROM ${name} ORDER BY rowid`).map(
    withoutLaterColumns,
  );

const presetColumns = (db: DatabaseSync) =>
  rows<Row>(db, `PRAGMA table_xinfo(${PRESETS})`);

function everythingButPresetColumns(db: DatabaseSync) {
  const tables = rows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map(({ name }) => name);
  return {
    objects: rows<Row>(
      db,
      `SELECT type, name, tbl_name, sql FROM sqlite_master
       WHERE name != '${PRESETS}' ORDER BY type, name`,
    ).map(withoutLaterDdl),
    data: Object.fromEntries(tables.map((name) => [name, table(db, name)])),
    sequences: rows(db, 'SELECT * FROM sqlite_sequence ORDER BY name'),
    foreignKeys: Object.fromEntries(
      tables.map((name) => [
        name,
        rows(db, `PRAGMA foreign_key_list(${name})`),
      ]),
    ),
    indexes: Object.fromEntries(
      tables.map((name) => [name, rows(db, `PRAGMA index_list(${name})`)]),
    ),
  };
}

describe('migrate v30 to v31', () => {
  it('keeps every preset, every value, every other object and the id sequence', () => {
    const db = seededV30();
    const before = everythingButPresetColumns(db);
    expect(before.data[PRESETS]).toHaveLength(5);
    migrate(nodeSqliteDriver(db));
    expect(everythingButPresetColumns(db)).toEqual(before);
    expect(rows(db, `SELECT id FROM ${PRESETS} WHERE bpm IS NULL`)).toEqual([]);
    expect(rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('changes only whether a preset needs a tempo', () => {
    const db = seededV30();
    const before = presetColumns(db);
    migrate(nodeSqliteDriver(db));
    expect(presetColumns(db)).toEqual(
      before.map((column) =>
        column.name === 'bpm' ? { ...column, notnull: 0 } : column,
      ),
    );
  });

  it.each([
    ['an upgraded', seededV30],
    ['a fresh', () => new DatabaseSync(':memory:')],
  ])('lets %s database store a preset without a tempo', (_, open) => {
    const db = open();
    migrate(nodeSqliteDriver(db));
    db.exec(NULL_BPM_PRESET);
    expect(
      rows(
        db,
        "SELECT bpm, beats_per_bar FROM song_presets WHERE uuid = 'uuid-click-only'",
      ),
    ).toEqual([{ bpm: null, beats_per_bar: 4 }]);
  });

  it('still drops a deleted song from its presets and a deleted preset from setlists', () => {
    const db = seededV30();
    migrate(nodeSqliteDriver(db));
    db.exec('DELETE FROM songs WHERE id = 1');
    db.exec('DELETE FROM song_presets WHERE id = 7');
    expect(
      rows(
        db,
        'SELECT library_song_id FROM song_presets WHERE library_song_id IS NOT NULL',
      ),
    ).toEqual([]);
    expect(
      rows(db, 'SELECT id FROM setlist_items WHERE song_preset_id = 7'),
    ).toEqual([]);
  });
});
