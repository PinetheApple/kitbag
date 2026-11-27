import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV32Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

type Row = Record<string, unknown>;

const TOOL_DATA = 'tool_data';

const SEED: readonly string[] = [
  `INSERT INTO songs
     (title, artist, file_path, duration, format, created_at, beat_grid, downbeat_indices,
      bpm, uuid, analysis_status, meter_beats_per_bar, bar_one_seconds, speed, tempo_mode,
      manual_tempo_bpm, manual_tempo_anchor, manual_tempo_beats_per_bar)
   VALUES ('Hand set — café', 'Band', 'songs/h/hand.mp3', 180.5, 'mp3', 1700000400,
      X'0000003f', X'00000000', 97.5, 'uuid-hand', 'failed', 3, 1.25, 0.8, 'follow',
      97.3, 0.42, 3)`,
  `INSERT INTO stem_sets
     (id, name, created_at, uuid, source, stemdeck_job_id, bpm, beat_grid, lyrics_synced,
      click_grouping, speed, pitch, manual_tempo_bpm, manual_tempo_anchor,
      manual_tempo_beats_per_bar)
   VALUES (5, 'Echo — ünï', 1700000300, 'uuid-echo', 'stemdeck', 'job-echo', 120,
      X'0000003f', '[00:01.00]line', '[3,3,2]', 0.5, -2, 119.9, 0.5, 4)`,
  `INSERT INTO stems
     (stem_set_id, role, file_path, duration, format, channel_count, sample_rate, gain,
      muted, soloed, sort_order, pitch, waveform_path, frames, name)
   VALUES (5, 'drums', 'stems/5/drums.ogg', 200.25, 'ogg', 2, 48000, 0.75, 0, 1, 0, 0,
      'stems/5/drums.kwav', 9612000, 'Kit')`,
  'INSERT INTO play_queue (stem_set_id, song_id, position) VALUES (5, NULL, 0), (NULL, 1, 1)',
  'INSERT INTO setlist_items (setlist_id, song_preset_id, stem_set_id, position) VALUES (2, NULL, 5, 2)',
  "INSERT INTO subdivision_accents (subdivision, accents) VALUES (3, X'020101')",
  `INSERT INTO bpm_cache (title, artist, bpm, source, fetched_at)
   VALUES ('Señor', 'Band', 101.5, 'getsongbpm', 1700000500)`,
  "INSERT INTO route_latency (route, offset_ms, name, kind) VALUES ('bt:00:11', 212.5, 'Buds', 'bluetooth')",
  "INSERT INTO click_sounds (slot, uuid, name, file_name) VALUES (1, 'uuid-snap', 'Snap', 'click-1.wav')",
  `INSERT INTO preferences (key, value)
   VALUES ('tool_enabled_tuner', '0'), ('standalone_metronome', '{"bpm":132}')`,
];

function seededV32(): DatabaseSync {
  const db = buildV32Fixture();
  for (const statement of SEED) db.exec(statement);
  return db;
}

const tableNames = (db: DatabaseSync) =>
  rows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map(({ name }) => name);

function snapshot(db: DatabaseSync) {
  const tables = tableNames(db).filter((name) => name !== TOOL_DATA);
  return {
    objects: rows<Row>(
      db,
      `SELECT type, name, tbl_name, sql FROM sqlite_master
       WHERE tbl_name != '${TOOL_DATA}' ORDER BY type, name`,
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

describe('migrate v32 to v33', () => {
  it('keeps every row of every table and every other object', () => {
    const db = seededV32();
    const before = snapshot(db);
    for (const [name, data] of Object.entries(before.data))
      expect(data.length, name).toBeGreaterThan(0);
    migrate(nodeSqliteDriver(db));
    expect(snapshot(db)).toEqual(before);
    expect(rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it.each([
    ['an upgraded', seededV32],
    ['a fresh', () => new DatabaseSync(':memory:')],
  ])(
    'gives %s database an empty tool data table keyed by tool and key',
    (_, open) => {
      const db = open();
      migrate(nodeSqliteDriver(db));
      expect(rows(db, `SELECT * FROM ${TOOL_DATA}`)).toEqual([]);
      expect(
        rows<Row>(db, `PRAGMA table_info(${TOOL_DATA})`).map(
          ({ name, type, notnull, pk }) => ({ name, type, notnull, pk }),
        ),
      ).toEqual([
        { name: 'tool_id', type: 'TEXT', notnull: 1, pk: 1 },
        { name: 'key', type: 'TEXT', notnull: 1, pk: 2 },
        { name: 'value', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'updated_at', type: 'INTEGER', notnull: 1, pk: 0 },
      ]);
    },
  );
});
