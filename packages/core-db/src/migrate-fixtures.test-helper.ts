import { DatabaseSync } from 'node:sqlite';

import {
  MIGRATE_V6_TO_V7,
  MIGRATE_V7_TO_V8,
  MIGRATE_V8_TO_V9,
  MIGRATE_V9_TO_V10,
  MIGRATE_V10_TO_V11,
  MIGRATE_V11_TO_V12,
  MIGRATE_V12_TO_V13,
  MIGRATE_V13_TO_V14,
  V6_SCHEMA_VERSION,
  V7_SCHEMA_VERSION,
  V8_SCHEMA_VERSION,
  V9_SCHEMA_VERSION,
  V10_SCHEMA_VERSION,
  V11_SCHEMA_VERSION,
  V12_SCHEMA_VERSION,
  V13_SCHEMA_VERSION,
  V14_SCHEMA_VERSION,
} from './migrate';

const V6_DDL: readonly string[] = [
  `CREATE TABLE setlists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`,
  `CREATE TABLE songs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     setlist_id INTEGER NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
     position INTEGER NOT NULL,
     name TEXT NOT NULL,
     bpm REAL NOT NULL,
     beats_per_bar INTEGER NOT NULL,
     subdivision INTEGER NOT NULL,
     accents BLOB NOT NULL,
     poly_enabled INTEGER NOT NULL,
     poly_beats INTEGER NOT NULL,
     sound INTEGER NOT NULL,
     volume REAL NOT NULL,
     latency_offset REAL NOT NULL
   )`,
  `CREATE TABLE tunings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, notes BLOB NOT NULL)`,
  `CREATE TABLE library_songs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     artist TEXT NOT NULL,
     file_path TEXT NOT NULL,
     duration REAL NOT NULL,
     format TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     beat_grid BLOB,
     bpm REAL,
     waveform_path TEXT
   )`,
  `CREATE TABLE stem_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL)`,
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
  `CREATE TABLE practice_sessions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     start_time INTEGER NOT NULL,
     duration_seconds INTEGER NOT NULL,
     avg_bpm REAL NOT NULL,
     setlist_id INTEGER REFERENCES setlists (id) ON DELETE SET NULL,
     songs_played TEXT
   )`,
];

const V6_DATA: readonly string[] = [
  `INSERT INTO setlists (id, name) VALUES (1, 'Friday Set'), (2, 'Acoustic Set')`,
  `INSERT INTO songs
     (setlist_id, position, name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, volume, latency_offset)
   VALUES
     (1, 0, 'Opener', 128.0, 4, 1, X'03010101', 0, 0, 0, 1.0, 0.0),
     (1, 1, 'Bridge', 92.0, 3, 2, X'030101', 1, 5, 2, 0.8, -12.0),
     (2, 0, 'Ballad', 72.0, 4, 1, X'03010101', 0, 0, 1, 1.0, 5.0),
     (2, 1, 'Out of range', 500.0, 20, 1, X'0201', 1, 40, 9, 1.0, 0.0)`,
  `INSERT INTO tunings (name, notes) VALUES ('Drop D', X'26292E33383D')`,
  `INSERT INTO practice_sessions (start_time, duration_seconds, avg_bpm, setlist_id)
   VALUES (1700000000, 600, 120.0, 1), (1700000000, 300, 90.0, NULL)`,
  `INSERT INTO library_songs (title, artist, file_path, duration, format, created_at, bpm)
   VALUES ('Reference', 'Someone', 'music/ref.flac', 210.5, 'flac', 1700000000, 128.0)`,
];

export function rows<T>(db: DatabaseSync, sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

export function pragma(db: DatabaseSync, name: string): unknown {
  return db.prepare(`PRAGMA ${name}`).get()?.[name];
}

export function buildV6Fixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const statement of [...V6_DDL, ...V6_DATA]) db.exec(statement);
  db.exec(`PRAGMA user_version = ${String(V6_SCHEMA_VERSION)}`);
  return db;
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
  const db = buildV6Fixture();
  applyInTransaction(db, MIGRATE_V6_TO_V7);
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
