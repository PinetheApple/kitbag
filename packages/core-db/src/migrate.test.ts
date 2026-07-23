// SPEC §14 acceptance for core-db: an upgrading user keeps their setlists.
//
// Runs the real v6→v7 migration (./migrate.ts) against a fixture database built
// to the shape Drift persisted at schema v6 (see legacy/db/database.dart), then
// asserts the setlist→song membership survives. The final test is a sabotage
// check: it removes the membership-preserving step from the migration and
// proves the SAME guarantee assertion then fails — so a green run means the
// data survived, not that the assertion is asleep.
//
// Headless: uses node:sqlite as a stand-in driver. The migration is plain
// SQLite, so what runs here is byte-for-byte what op-sqlite runs on device.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  MIGRATE_V6_TO_V7,
  migrate,
  SCHEMA_VERSION,
  V6_SCHEMA_VERSION,
  type MigrationDriver,
} from './migrate';

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
}

interface CountRow {
  n: number;
}

interface VersionRow {
  user_version: number;
}

// The v6 on-disk schema (Drift-emitted, snake_case). Only the tables the
// migration touches are needed; the fixture data below exercises setlists,
// their presets, the library table (renamed to `songs`), and a tuning.
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
];

// Two setlists; the second shares presets with the first's ordering scheme.
// Numbers live inside SQL strings deliberately — fixture data, not logic.
const V6_DATA: readonly string[] = [
  `INSERT INTO setlists (id, name) VALUES (1, 'Friday Set'), (2, 'Acoustic Set')`,
  `INSERT INTO songs
     (setlist_id, position, name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, volume, latency_offset)
   VALUES
     (1, 0, 'Opener', 128.0, 4, 1, X'03010101', 0, 0, 0, 1.0, 0.0),
     (1, 1, 'Bridge', 92.0, 3, 2, X'030101', 1, 5, 2, 0.8, -12.0),
     (2, 0, 'Ballad', 72.0, 4, 1, X'03010101', 0, 0, 1, 1.0, 5.0)`,
  `INSERT INTO tunings (name, notes) VALUES ('Drop D', X'26292E33383D')`,
  `INSERT INTO library_songs (title, artist, file_path, duration, format, created_at, bpm)
   VALUES ('Reference', 'Someone', 'music/ref.flac', 210.5, 'flac', 1700000000, 128.0)`,
];

// node:sqlite types rows as `Record<string, SQLOutputValue>`; these return
// `unknown` so each call site casts to the shape its query produces (the driver
// cannot know the column types).
function rows(db: DatabaseSync, sql: string): unknown[] {
  return db.prepare(sql).all();
}

function firstRow(db: DatabaseSync, sql: string): unknown {
  return db.prepare(sql).get();
}

function buildV6Fixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const stmt of [...V6_DDL, ...V6_DATA]) {
    db.exec(stmt);
  }
  db.exec(`PRAGMA user_version = ${String(V6_SCHEMA_VERSION)}`);
  return db;
}

function driverFor(db: DatabaseSync): MigrationDriver {
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    getUserVersion: () =>
      (firstRow(db, 'PRAGMA user_version') as VersionRow).user_version,
    setUserVersion: (version) => {
      db.exec(`PRAGMA user_version = ${String(version)}`);
    },
  };
}

/** Setlist membership as recorded in v6's `songs` table (before migration). */
function readV6Membership(db: DatabaseSync): Membership[] {
  return rows(
    db,
    'SELECT setlist_id, id AS song_preset_id, position FROM songs ORDER BY setlist_id, position',
  ) as Membership[];
}

/** Setlist membership as recorded in v7's `setlist_items` table (after migration). */
function readV7Membership(db: DatabaseSync): Membership[] {
  return rows(
    db,
    'SELECT setlist_id, song_preset_id, position FROM setlist_items ORDER BY setlist_id, position',
  ) as Membership[];
}

function readSetlistNames(db: DatabaseSync): NameRow[] {
  return rows(db, 'SELECT id, name FROM setlists ORDER BY id') as NameRow[];
}

/**
 * The SPEC §14 guarantee, as a single assertion so the sabotage test can prove
 * it bites: every v6 setlist row still exists with its name, and every song's
 * setlist membership survived the split into `setlist_items`.
 */
function assertSetlistsPreserved(
  db: DatabaseSync,
  beforeNames: NameRow[],
  beforeMembership: Membership[],
): void {
  expect(readSetlistNames(db)).toEqual(beforeNames);
  expect(readV7Membership(db)).toEqual(beforeMembership);
}

/** Run statements the way `migrate()` does, so a sabotaged list is a fair test. */
function applyInTransaction(
  db: DatabaseSync,
  statements: readonly string[],
): void {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  for (const stmt of statements) {
    db.exec(stmt);
  }
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
}

describe('v6 → v7 migration', () => {
  it('preserves setlists and their song membership', () => {
    const db = buildV6Fixture();
    const beforeNames = readSetlistNames(db);
    const beforeMembership = readV6Membership(db);

    migrate(driverFor(db));

    // The core guarantee (SPEC §11.1, §14).
    assertSetlistsPreserved(db, beforeNames, beforeMembership);

    // Version advanced and FK enforcement restored.
    expect(
      (firstRow(db, 'PRAGMA user_version') as VersionRow).user_version,
    ).toBe(SCHEMA_VERSION);
    expect(
      (firstRow(db, 'PRAGMA foreign_keys') as { foreign_keys: number })
        .foreign_keys,
    ).toBe(1);

    db.close();
  });

  it('applies the §11.2 shape changes (rename, D3 drop, new tables)', () => {
    const db = buildV6Fixture();
    migrate(driverFor(db));

    const tableNames = (
      rows(
        db,
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      ) as ColumnRow[]
    ).map((row) => row.name);
    for (const expected of [
      'songs',
      'song_presets',
      'setlist_items',
      'subdivision_accents',
      'bpm_cache',
      'route_latency',
    ]) {
      expect(tableNames).toContain(expected);
    }
    // v6 names are gone: library became `songs`, presets rebuilt, temp dropped.
    expect(tableNames).not.toContain('library_songs');
    expect(tableNames).not.toContain('song_presets_v6');

    const presetColumns = (
      rows(db, 'PRAGMA table_info(song_presets)') as ColumnRow[]
    ).map((row) => row.name);
    expect(presetColumns).toContain('denominator'); // D1
    expect(presetColumns).toContain('library_song_id'); // D4
    expect(presetColumns).not.toContain('volume'); // D3
    expect(presetColumns).not.toContain('latency_offset'); // D3
    expect(presetColumns).not.toContain('setlist_id'); // decoupled

    const songColumns = (
      rows(db, 'PRAGMA table_info(songs)') as ColumnRow[]
    ).map((row) => row.name);
    expect(songColumns).toContain('downbeat_indices'); // §4.3

    // Every exportable row got a backfilled UUID (§12.4) — none left null.
    for (const table of [
      'setlists',
      'songs',
      'song_presets',
      'tunings',
      'stem_sets',
    ]) {
      const nullCount = (
        firstRow(
          db,
          `SELECT count(*) AS n FROM ${table} WHERE uuid IS NULL`,
        ) as CountRow
      ).n;
      expect(nullCount).toBe(0);
    }

    db.close();
  });

  it('is a no-op on an already-current database', () => {
    const db = buildV6Fixture();
    migrate(driverFor(db));
    const membership = readV7Membership(db);

    // Second run: version is already current, nothing changes.
    migrate(driverFor(db));
    expect(readV7Membership(db)).toEqual(membership);

    db.close();
  });

  // SABOTAGE: strip the step that carries setlist membership into `setlist_items`
  // and prove the guarantee assertion FAILS. If this test's `toThrow` did not
  // fire, the passing test above would be worthless.
  it('sabotage: dropping the membership step makes the guarantee fail', () => {
    const db = buildV6Fixture();
    const beforeNames = readSetlistNames(db);
    const beforeMembership = readV6Membership(db);

    const sabotaged = MIGRATE_V6_TO_V7.filter(
      (stmt) => !stmt.startsWith('INSERT INTO setlist_items'),
    );
    // Sanity: the sabotage actually removed exactly the membership step.
    expect(sabotaged.length).toBe(MIGRATE_V6_TO_V7.length - 1);

    applyInTransaction(db, sabotaged);

    // Setlists themselves still exist...
    expect(readSetlistNames(db)).toEqual(beforeNames);
    // ...but their membership was lost, so the guarantee assertion must throw.
    expect(() => {
      assertSetlistsPreserved(db, beforeNames, beforeMembership);
    }).toThrow();
    expect(readV7Membership(db)).toEqual([]);

    db.close();
  });
});
