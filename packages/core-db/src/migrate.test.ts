import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  MIGRATE_V6_TO_V7,
  MIGRATE_V7_TO_V8,
  migrate,
  SCHEMA_VERSION,
  V6_SCHEMA_VERSION,
  V7_SCHEMA_VERSION,
  V8_SCHEMA_VERSION,
} from './migrate';
import { nodeSqliteDriver } from './sqlite.test-helper';

interface Membership {
  setlist_id: number;
  song_preset_id: number;
  position: number;
}

interface NameRow {
  id: number;
  name: string;
}

interface ColumnRow {
  name: string;
  type: string;
}

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
     (2, 0, 'Ballad', 72.0, 4, 1, X'03010101', 0, 0, 1, 1.0, 5.0)`,
  `INSERT INTO tunings (name, notes) VALUES ('Drop D', X'26292E33383D')`,
  `INSERT INTO practice_sessions (start_time, duration_seconds, avg_bpm, setlist_id)
   VALUES (1700000000, 600, 120.0, 1), (1700000000, 300, 90.0, NULL)`,
  `INSERT INTO library_songs (title, artist, file_path, duration, format, created_at, bpm)
   VALUES ('Reference', 'Someone', 'music/ref.flac', 210.5, 'flac', 1700000000, 128.0)`,
];

function rows<T>(db: DatabaseSync, sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

function pragma(db: DatabaseSync, name: string): unknown {
  return db.prepare(`PRAGMA ${name}`).get()?.[name];
}

function buildV6Fixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const statement of [...V6_DDL, ...V6_DATA]) db.exec(statement);
  db.exec(`PRAGMA user_version = ${String(V6_SCHEMA_VERSION)}`);
  return db;
}

function applyInTransaction(db: DatabaseSync, statements: readonly string[]) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  for (const statement of statements) db.exec(statement);
  db.exec('COMMIT');
}

function buildV7Fixture(): DatabaseSync {
  const db = buildV6Fixture();
  applyInTransaction(db, MIGRATE_V6_TO_V7);
  db.exec(`PRAGMA user_version = ${String(V7_SCHEMA_VERSION)}`);
  return db;
}

const readV6Membership = (db: DatabaseSync) =>
  rows<Membership>(
    db,
    'SELECT setlist_id, id AS song_preset_id, position FROM songs ORDER BY setlist_id, position',
  );

const readMembership = (db: DatabaseSync) =>
  rows<Membership>(
    db,
    'SELECT setlist_id, song_preset_id, position FROM setlist_items ORDER BY setlist_id, position',
  );

const readSetlistNames = (db: DatabaseSync) =>
  rows<NameRow>(db, 'SELECT id, name FROM setlists ORDER BY id');

const tableNames = (db: DatabaseSync) =>
  rows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((row) => row.name);

const columnNames = (db: DatabaseSync, table: string) =>
  rows<ColumnRow>(db, `PRAGMA table_info(${table})`).map((row) => row.name);

function shape(db: DatabaseSync) {
  return {
    tables: Object.fromEntries(
      tableNames(db).map((table) => [
        table,
        rows<ColumnRow>(db, `PRAGMA table_info(${table})`)
          .map(({ name, type }) => `${name} ${type}`)
          .sort(),
      ]),
    ),
    indexes: rows<{ name: string; sql: string }>(
      db,
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
    ),
  };
}

function assertSetlistsPreserved(
  db: DatabaseSync,
  beforeNames: NameRow[],
  beforeMembership: Membership[],
): void {
  expect(readSetlistNames(db)).toEqual(beforeNames);
  expect(readMembership(db)).toEqual(beforeMembership);
}

describe('migrate', () => {
  it('preserves v6 setlists and their song membership', () => {
    const db = buildV6Fixture();
    const beforeNames = readSetlistNames(db);
    const beforeMembership = readV6Membership(db);
    migrate(nodeSqliteDriver(db));
    assertSetlistsPreserved(db, beforeNames, beforeMembership);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
    expect(pragma(db, 'foreign_keys')).toBe(1);
  });

  it('applies the v6 shape changes', () => {
    const db = buildV6Fixture();
    migrate(nodeSqliteDriver(db));
    const tables = tableNames(db);
    expect(tables).toEqual(
      expect.arrayContaining([
        'songs',
        'song_presets',
        'setlist_items',
        'subdivision_accents',
        'bpm_cache',
        'route_latency',
      ]),
    );
    expect(tables).not.toContain('library_songs');
    expect(tables).not.toContain('song_presets_v6');
    const presetColumns = columnNames(db, 'song_presets');
    expect(presetColumns).toEqual(
      expect.arrayContaining(['denominator', 'library_song_id']),
    );
    for (const dropped of ['volume', 'latency_offset', 'setlist_id'])
      expect(presetColumns).not.toContain(dropped);
    expect(columnNames(db, 'songs')).toContain('downbeat_indices');
  });

  it('backfills a uuid on every exportable v6 row', () => {
    const db = buildV6Fixture();
    migrate(nodeSqliteDriver(db));
    for (const table of [
      'setlists',
      'songs',
      'song_presets',
      'tunings',
      'stem_sets',
      'practice_sessions',
    ])
      expect(
        rows(db, `SELECT id FROM ${table} WHERE uuid IS NULL`),
      ).toHaveLength(0);
  });

  it('builds the same tables, column types and indexes fresh as migrated', () => {
    const fresh = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(fresh));
    const migrated = buildV6Fixture();
    migrate(nodeSqliteDriver(migrated));
    expect(shape(migrated)).toEqual(shape(fresh));
    expect(shape(fresh).indexes.map((index) => index.name)).toContain(
      'setlists_one_active',
    );
  });

  it('upgrades a v7 database with data, keeping every setlist inactive', () => {
    const db = buildV7Fixture();
    const beforeNames = readSetlistNames(db);
    const beforeMembership = readMembership(db);
    migrate(nodeSqliteDriver(db));
    assertSetlistsPreserved(db, beforeNames, beforeMembership);
    expect(rows(db, 'SELECT id FROM setlists WHERE active != 0')).toEqual([]);
    expect(columnNames(db, 'song_presets')).toContain('poly_accents');
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('upgrades a v8 database, giving each practice session a distinct uuid', () => {
    const db = buildV7Fixture();
    applyInTransaction(db, MIGRATE_V7_TO_V8);
    db.exec(`PRAGMA user_version = ${String(V8_SCHEMA_VERSION)}`);
    const before = rows(
      db,
      'SELECT id, start_time, avg_bpm FROM practice_sessions ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(
      rows(
        db,
        'SELECT id, start_time, avg_bpm FROM practice_sessions ORDER BY id',
      ),
    ).toEqual(before);
    const uuids = rows<{ uuid: string }>(
      db,
      'SELECT uuid FROM practice_sessions',
    ).map((row) => row.uuid);
    expect(new Set(uuids).size).toBe(before.length);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('rolls the whole v6 upgrade back when a later step fails', () => {
    const db = buildV6Fixture();
    db.exec('CREATE TABLE setlists_one_active_blocker (id INTEGER)');
    db.exec(
      'CREATE INDEX setlists_one_active ON setlists_one_active_blocker (id)',
    );
    expect(() => {
      migrate(nodeSqliteDriver(db));
    }).toThrow();
    expect(tableNames(db)).toContain('library_songs');
    expect(tableNames(db)).not.toContain('setlist_items');
    expect(pragma(db, 'user_version')).toBe(V6_SCHEMA_VERSION);
  });

  it('is a no-op on a current database but still enables foreign keys', () => {
    const db = buildV6Fixture();
    migrate(nodeSqliteDriver(db));
    const membership = readMembership(db);
    db.exec('PRAGMA foreign_keys = OFF');
    migrate(nodeSqliteDriver(db));
    expect(readMembership(db)).toEqual(membership);
    expect(pragma(db, 'foreign_keys')).toBe(1);
  });

  it('sabotage: dropping the membership step makes the guarantee fail', () => {
    const db = buildV6Fixture();
    const beforeNames = readSetlistNames(db);
    const beforeMembership = readV6Membership(db);
    const sabotaged = MIGRATE_V6_TO_V7.filter(
      (statement) => !statement.startsWith('INSERT INTO setlist_items'),
    );
    expect(sabotaged).toHaveLength(MIGRATE_V6_TO_V7.length - 1);
    applyInTransaction(db, sabotaged);
    expect(readSetlistNames(db)).toEqual(beforeNames);
    expect(() => {
      assertSetlistsPreserved(db, beforeNames, beforeMembership);
    }).toThrow();
  });

  it('allows at most one active setlist on a fresh database', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
    db.exec("INSERT INTO setlists (name, uuid, active) VALUES ('A', 'a', 1)");
    expect(() => {
      db.exec("INSERT INTO setlists (name, uuid, active) VALUES ('B', 'b', 1)");
    }).toThrow();
  });
});
