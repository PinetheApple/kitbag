import { DatabaseSync } from 'node:sqlite';

import { CLICK_RATE } from './click-rate';
import {
  MIGRATE_V7_TO_V8,
  MIGRATE_V8_TO_V9,
  MIGRATE_V9_TO_V10,
  MIGRATE_V10_TO_V11,
  MIGRATE_V11_TO_V12,
  MIGRATE_V12_TO_V13,
  MIGRATE_V13_TO_V14,
  MIGRATE_V14_TO_V15,
  MIGRATE_V15_TO_V16,
  MIGRATE_V16_TO_V17,
  MIGRATE_V17_TO_V18,
  MIGRATE_V18_TO_V19,
  MIGRATE_V19_TO_V20,
  MIGRATE_V20_TO_V21,
  MIGRATE_V21_TO_V22,
  MIGRATE_V22_TO_V23,
  MIGRATE_V23_TO_V24,
  MIGRATE_V24_TO_V25,
  MIGRATE_V25_TO_V26,
  V7_SCHEMA_VERSION,
  V8_SCHEMA_VERSION,
  V9_SCHEMA_VERSION,
  V10_SCHEMA_VERSION,
  V11_SCHEMA_VERSION,
  V12_SCHEMA_VERSION,
  V13_SCHEMA_VERSION,
  V14_SCHEMA_VERSION,
  V15_SCHEMA_VERSION,
  V16_SCHEMA_VERSION,
  V17_SCHEMA_VERSION,
  V18_SCHEMA_VERSION,
  V19_SCHEMA_VERSION,
  V20_SCHEMA_VERSION,
  V21_SCHEMA_VERSION,
  V22_SCHEMA_VERSION,
  V23_SCHEMA_VERSION,
  V24_SCHEMA_VERSION,
  V25_SCHEMA_VERSION,
  V26_SCHEMA_VERSION,
} from './migrate';

const V7_DDL: readonly string[] = [
  `CREATE TABLE setlists (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     uuid TEXT NOT NULL
   )`,
  `CREATE TABLE songs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     artist TEXT NOT NULL,
     file_path TEXT NOT NULL,
     duration REAL NOT NULL,
     format TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     beat_grid BLOB,
     downbeat_indices BLOB,
     bpm REAL,
     waveform_path TEXT,
     uuid TEXT NOT NULL
   )`,
  `CREATE TABLE song_presets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     bpm REAL NOT NULL,
     beats_per_bar INTEGER NOT NULL,
     subdivision INTEGER NOT NULL,
     denominator INTEGER NOT NULL DEFAULT 4,
     accents BLOB NOT NULL,
     per_accent_sounds BLOB,
     poly_enabled INTEGER NOT NULL,
     poly_beats INTEGER NOT NULL,
     sound INTEGER NOT NULL,
     ramp_enabled INTEGER NOT NULL DEFAULT 0,
     ramp_start_bpm REAL,
     ramp_end_bpm REAL,
     ramp_bars INTEGER,
     bar_mute_enabled INTEGER NOT NULL DEFAULT 0,
     bar_mute_play_bars INTEGER,
     bar_mute_mute_bars INTEGER,
     count_in_bars INTEGER NOT NULL DEFAULT 0,
     notes TEXT,
     phase_nudge REAL NOT NULL DEFAULT 0,
     title TEXT,
     artist TEXT,
     source TEXT,
     length_seconds REAL,
     library_song_id INTEGER REFERENCES songs (id) ON DELETE SET NULL,
     uuid TEXT NOT NULL
   )`,
  `CREATE TABLE setlist_items (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     setlist_id INTEGER NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
     song_preset_id INTEGER NOT NULL REFERENCES song_presets (id) ON DELETE CASCADE,
     position INTEGER NOT NULL
   )`,
  `CREATE TABLE tunings (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     notes BLOB NOT NULL,
     uuid TEXT NOT NULL
   )`,
  `CREATE TABLE practice_sessions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     start_time INTEGER NOT NULL,
     duration_seconds INTEGER NOT NULL,
     avg_bpm REAL NOT NULL,
     setlist_id INTEGER REFERENCES setlists (id) ON DELETE SET NULL,
     songs_played TEXT
   )`,
  `CREATE TABLE stem_sets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     uuid TEXT NOT NULL
   )`,
  `CREATE TABLE stems (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     stem_set_id INTEGER NOT NULL REFERENCES stem_sets (id) ON DELETE CASCADE,
     role TEXT NOT NULL,
     file_path TEXT NOT NULL,
     duration REAL NOT NULL,
     format TEXT NOT NULL,
     channel_count INTEGER NOT NULL,
     sample_rate INTEGER NOT NULL,
     gain REAL NOT NULL,
     muted INTEGER NOT NULL,
     soloed INTEGER NOT NULL,
     sort_order INTEGER NOT NULL
   )`,
  `CREATE TABLE subdivision_accents (
     subdivision INTEGER PRIMARY KEY,
     accents BLOB NOT NULL
   )`,
  `CREATE TABLE bpm_cache (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     artist TEXT NOT NULL,
     bpm REAL NOT NULL,
     source TEXT NOT NULL,
     fetched_at INTEGER NOT NULL
   )`,
  'CREATE UNIQUE INDEX bpm_cache_title_artist ON bpm_cache (title, artist)',
  `CREATE TABLE route_latency (
     route TEXT PRIMARY KEY,
     offset_ms REAL NOT NULL
   )`,
];

const V7_DATA: readonly string[] = [
  `INSERT INTO setlists (id, name, uuid)
   VALUES (1, 'Friday Set', 'uuid-friday'), (2, 'Acoustic Set', 'uuid-acoustic')`,
  `INSERT INTO song_presets
     (id, name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, uuid)
   VALUES
     (1, 'Opener', 128.0, 4, 1, X'03010101', 0, 0, 0, 'uuid-opener'),
     (2, 'Bridge', 92.0, 3, 2, X'030101', 1, 5, 2, 'uuid-bridge'),
     (3, 'Ballad', 72.0, 4, 1, X'03010101', 0, 0, 1, 'uuid-ballad'),
     (4, 'Out of range', 500.0, 20, 1, X'0201', 1, 40, 9, 'uuid-range')`,
  `INSERT INTO setlist_items (setlist_id, song_preset_id, position)
   VALUES (1, 1, 0), (1, 2, 1), (2, 3, 0), (2, 4, 1)`,
  `INSERT INTO tunings (name, notes, uuid) VALUES ('Drop D', X'26292E33383D', 'uuid-drop-d')`,
  `INSERT INTO practice_sessions (start_time, duration_seconds, avg_bpm, setlist_id)
   VALUES (1700000000, 600, 120.0, 1), (1700000000, 300, 90.0, NULL)`,
  `INSERT INTO songs (title, artist, file_path, duration, format, created_at, bpm, uuid)
   VALUES ('Reference', 'Someone', 'music/ref.flac', 210.5, 'flac', 1700000000, 128.0, 'uuid-reference')`,
];

export const V20_SONG_COLUMNS = {
  analysis_version: null,
  meter_beats_per_bar: null,
  bar_one_seconds: null,
};

export const V24_SONG_COLUMNS = { tempo_correction: null };

export const V20_STEM_SET_COLUMNS = {
  meter_beats_per_bar: null,
  bar_one_seconds: null,
};

export const V21_CLICK_COLUMNS = {
  click_grouping: null,
  click_rate: CLICK_RATE.single,
};

export const V21_STEM_SET_COLUMNS = {
  ...V20_STEM_SET_COLUMNS,
  ...V21_CLICK_COLUMNS,
};

export const V22_TEMPO_COLUMNS = {
  tempo_mode: null,
  tempo_bpm: null,
  tempo_anchor: null,
  tempo_beats_per_bar: null,
  tempo_source: null,
  chosen_tempo_mode: null,
};

export const V27_STEM_SET_COLUMNS = { pitch: 0 };

export const V22_STEM_SET_COLUMNS = {
  ...V21_STEM_SET_COLUMNS,
  ...V22_TEMPO_COLUMNS,
};

export function rows<T>(db: DatabaseSync, sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

export function pragma(db: DatabaseSync, name: string): unknown {
  return db.prepare(`PRAGMA ${name}`).get()?.[name];
}

export function applyInTransaction(
  db: DatabaseSync,
  statements: readonly string[],
) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  for (const statement of statements) db.exec(statement);
  db.exec('COMMIT');
}

export function buildV7Fixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const statement of [...V7_DDL, ...V7_DATA]) db.exec(statement);
  db.exec(`PRAGMA user_version = ${String(V7_SCHEMA_VERSION)}`);
  return db;
}

export function buildV8Fixture(): DatabaseSync {
  const db = buildV7Fixture();
  applyInTransaction(db, MIGRATE_V7_TO_V8);
  db.exec(`PRAGMA user_version = ${String(V8_SCHEMA_VERSION)}`);
  return db;
}

export function buildV9Fixture(): DatabaseSync {
  const db = buildV8Fixture();
  applyInTransaction(db, MIGRATE_V8_TO_V9);
  db.exec(`PRAGMA user_version = ${String(V9_SCHEMA_VERSION)}`);
  return db;
}

export function buildV10Fixture(): DatabaseSync {
  const db = buildV9Fixture();
  applyInTransaction(db, MIGRATE_V9_TO_V10);
  db.exec(`PRAGMA user_version = ${String(V10_SCHEMA_VERSION)}`);
  return db;
}

export function buildV11Fixture(): DatabaseSync {
  const db = buildV10Fixture();
  applyInTransaction(db, MIGRATE_V10_TO_V11);
  db.exec(`PRAGMA user_version = ${String(V11_SCHEMA_VERSION)}`);
  return db;
}

export function buildV12Fixture(): DatabaseSync {
  const db = buildV11Fixture();
  applyInTransaction(db, MIGRATE_V11_TO_V12);
  db.exec(`PRAGMA user_version = ${String(V12_SCHEMA_VERSION)}`);
  return db;
}

export function buildV13Fixture(): DatabaseSync {
  const db = buildV12Fixture();
  applyInTransaction(db, MIGRATE_V12_TO_V13);
  db.exec(`PRAGMA user_version = ${String(V13_SCHEMA_VERSION)}`);
  return db;
}

export function buildV14Fixture(): DatabaseSync {
  const db = buildV13Fixture();
  applyInTransaction(db, MIGRATE_V13_TO_V14);
  db.exec(`PRAGMA user_version = ${String(V14_SCHEMA_VERSION)}`);
  return db;
}

export function buildV15Fixture(): DatabaseSync {
  const db = buildV14Fixture();
  applyInTransaction(db, MIGRATE_V14_TO_V15);
  db.exec(`PRAGMA user_version = ${String(V15_SCHEMA_VERSION)}`);
  return db;
}

export function buildV16Fixture(): DatabaseSync {
  const db = buildV15Fixture();
  applyInTransaction(db, MIGRATE_V15_TO_V16);
  db.exec(`PRAGMA user_version = ${String(V16_SCHEMA_VERSION)}`);
  return db;
}

export function buildV17Fixture(): DatabaseSync {
  const db = buildV16Fixture();
  applyInTransaction(db, MIGRATE_V16_TO_V17);
  db.exec(`PRAGMA user_version = ${String(V17_SCHEMA_VERSION)}`);
  return db;
}

export function buildV18Fixture(): DatabaseSync {
  const db = buildV17Fixture();
  applyInTransaction(db, MIGRATE_V17_TO_V18);
  db.exec(`PRAGMA user_version = ${String(V18_SCHEMA_VERSION)}`);
  return db;
}

export function buildV19Fixture(): DatabaseSync {
  const db = buildV18Fixture();
  applyInTransaction(db, MIGRATE_V18_TO_V19);
  db.exec(`PRAGMA user_version = ${String(V19_SCHEMA_VERSION)}`);
  return db;
}

export function buildV20Fixture(): DatabaseSync {
  const db = buildV19Fixture();
  applyInTransaction(db, MIGRATE_V19_TO_V20);
  db.exec(`PRAGMA user_version = ${String(V20_SCHEMA_VERSION)}`);
  return db;
}

export function buildV21Fixture(): DatabaseSync {
  const db = buildV20Fixture();
  applyInTransaction(db, MIGRATE_V20_TO_V21);
  db.exec(`PRAGMA user_version = ${String(V21_SCHEMA_VERSION)}`);
  return db;
}

export function buildV22Fixture(): DatabaseSync {
  const db = buildV21Fixture();
  applyInTransaction(db, MIGRATE_V21_TO_V22);
  db.exec(`PRAGMA user_version = ${String(V22_SCHEMA_VERSION)}`);
  return db;
}

export function buildV23Fixture(): DatabaseSync {
  const db = buildV22Fixture();
  applyInTransaction(db, MIGRATE_V22_TO_V23);
  db.exec(`PRAGMA user_version = ${String(V23_SCHEMA_VERSION)}`);
  return db;
}

export function buildV24Fixture(): DatabaseSync {
  const db = buildV23Fixture();
  applyInTransaction(db, MIGRATE_V23_TO_V24);
  db.exec(`PRAGMA user_version = ${String(V24_SCHEMA_VERSION)}`);
  return db;
}

export function buildV25Fixture(): DatabaseSync {
  const db = buildV24Fixture();
  applyInTransaction(db, MIGRATE_V24_TO_V25);
  db.exec(`PRAGMA user_version = ${String(V25_SCHEMA_VERSION)}`);
  return db;
}

export function buildV26Fixture(): DatabaseSync {
  const db = buildV25Fixture();
  applyInTransaction(db, MIGRATE_V25_TO_V26);
  db.exec(`PRAGMA user_version = ${String(V26_SCHEMA_VERSION)}`);
  return db;
}
