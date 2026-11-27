import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV31Fixture,
  pragma,
  rows,
  V32_MANUAL_TEMPO_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

type Row = Record<string, unknown>;

const GAINED = new Set(['songs', 'stem_sets']);

const ANALYSED_SONG = `INSERT INTO songs
  (title, artist, file_path, duration, format, created_at, beat_grid, downbeat_indices,
   bpm, waveform_path, uuid, analysis_status, analysis_error, analysis_version,
   meter_beats_per_bar, bar_one_seconds, tempo_correction, speed, tempo_mode, tempo_bpm,
   tempo_anchor, tempo_beats_per_bar, tempo_source, chosen_tempo_mode)
  VALUES ('Drift — café', 'Band', 'songs/d/drift.mp3', 241.25, 'mp3', 1700000100,
   X'0000003f0000803f', X'00000000', 121.5, 'songs/d/drift.kwav', 'uuid-drift', 'done',
   NULL, 4, 3, 2.75, 'double', 0.75, 'follow', 121.5, 0.25, 4, 'analysed', 'constant')`;

const FAILED_SONG = `INSERT INTO songs
  (title, artist, file_path, duration, format, created_at, uuid, analysis_status, analysis_error)
  VALUES ('Rubato', '', 'songs/r/rubato.flac', 300, 'flac', 1700000200, 'uuid-rubato',
   'failed', 'no beat')`;

const STEM_SET = `INSERT INTO stem_sets
  (name, created_at, uuid, source, stemdeck_job_id, bpm, beat_grid, bar_marks,
   meter_beats_per_bar, bar_one_seconds, click_grouping, click_rate, tempo_mode, tempo_bpm,
   tempo_anchor, tempo_beats_per_bar, tempo_source, chosen_tempo_mode, speed, pitch)
  VALUES ('Echo', 1700000300, 'uuid-echo', 'stemdeck', 'job-echo', 120,
   X'0000003f', X'0000000004000000', 4, 0.5, '[3,3,2]', 'double', 'follow', 120, 0.5, 4,
   'detected', 'constant', 0.5, -2)`;

function seededV31(): DatabaseSync {
  const db = buildV31Fixture();
  for (const statement of [ANALYSED_SONG, FAILED_SONG, STEM_SET])
    db.exec(statement);
  return db;
}

const tableNames = (db: DatabaseSync) =>
  rows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map(({ name }) => name);

function snapshot(db: DatabaseSync) {
  const tables = tableNames(db);
  return {
    objects: rows<Row>(
      db,
      `SELECT type, name, tbl_name, sql FROM sqlite_master
       WHERE tbl_name NOT IN ('songs', 'stem_sets') ORDER BY type, name`,
    ),
    indexes: rows<Row>(
      db,
      `SELECT name, tbl_name, sql FROM sqlite_master
       WHERE type = 'index' ORDER BY name`,
    ),
    data: Object.fromEntries(
      tables.map((name) => [
        name,
        rows<Row>(db, `SELECT * FROM ${name} ORDER BY rowid`),
      ]),
    ),
    sequences: rows(db, 'SELECT * FROM sqlite_sequence ORDER BY name'),
  };
}

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
    ({ name }) => name,
  );

describe('migrate v31 to v32', () => {
  it('keeps every row and value, giving songs and stem songs no manual tempo', () => {
    const db = seededV31();
    const before = snapshot(db);
    expect(before.data.songs).toHaveLength(3);
    expect(before.data.stem_sets).toHaveLength(1);
    migrate(nodeSqliteDriver(db));
    const after = snapshot(db);
    expect(after.objects).toEqual(before.objects);
    expect(after.indexes).toEqual(before.indexes);
    expect(after.sequences).toEqual(before.sequences);
    expect(after.data).toEqual(
      Object.fromEntries(
        Object.entries(before.data).map(([name, data]) => [
          name,
          GAINED.has(name)
            ? data.map((row) => ({ ...row, ...V32_MANUAL_TEMPO_COLUMNS }))
            : data,
        ]),
      ),
    );
    expect(rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it.each([
    ['an upgraded', seededV31],
    ['a fresh', () => new DatabaseSync(':memory:')],
  ])('gives %s database the manual tempo columns', (_, open) => {
    const db = open();
    migrate(nodeSqliteDriver(db));
    for (const table of GAINED)
      expect(columns(db, table)).toEqual(
        expect.arrayContaining(Object.keys(V32_MANUAL_TEMPO_COLUMNS)),
      );
  });
});
