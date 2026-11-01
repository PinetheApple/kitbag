import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  MIGRATE_V6_TO_V7,
  migrate,
  SCHEMA_VERSION,
  V6_SCHEMA_VERSION,
} from './migrate';
import {
  applyInTransaction,
  buildV6Fixture,
  buildV7Fixture,
  buildV8Fixture,
  buildV9Fixture,
  buildV10Fixture,
  buildV11Fixture,
  buildV12Fixture,
  buildV13Fixture,
  buildV14Fixture,
  pragma,
  rows,
} from './migrate-fixtures.test-helper';
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

  it.each([
    ['v6', buildV6Fixture],
    ['v7', buildV7Fixture],
    ['v8', buildV8Fixture],
    ['v9', buildV9Fixture],
    ['v10', buildV10Fixture],
    ['v11', buildV11Fixture],
    ['v12', buildV12Fixture],
    ['v13', buildV13Fixture],
    ['v14', buildV14Fixture],
  ])(
    'builds the same tables, column types and indexes fresh as from %s',
    (_from, build) => {
      const fresh = new DatabaseSync(':memory:');
      migrate(nodeSqliteDriver(fresh));
      const migrated = build();
      migrate(nodeSqliteDriver(migrated));
      expect(shape(migrated)).toEqual(shape(fresh));
      expect(shape(fresh).indexes.map((index) => index.name)).toContain(
        'setlists_one_active',
      );
    },
  );

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
    const db = buildV8Fixture();
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

  it('upgrades a v9 database, reading every existing tuning as guitar', () => {
    const db = buildV9Fixture();
    expect(columnNames(db, 'tunings')).not.toContain('instrument');
    const before = rows(db, 'SELECT id, name, notes, uuid FROM tunings');
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT id, name, notes, uuid FROM tunings')).toEqual(
      before,
    );
    expect(rows(db, 'SELECT name, instrument FROM tunings')).toEqual([
      { name: 'Drop D', instrument: 0 },
    ]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('upgrades a v10 database, keeping its rows and adding empty preferences', () => {
    const db = buildV10Fixture();
    expect(tableNames(db)).not.toContain('preferences');
    const before = rows(db, 'SELECT * FROM tunings ORDER BY id');
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM tunings ORDER BY id')).toEqual(before);
    expect(rows(db, 'SELECT * FROM preferences')).toEqual([]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('upgrades a v11 database, moving ramp_bars to ramp_length as a bar ramp without loop', () => {
    const db = buildV11Fixture();
    db.exec('UPDATE song_presets SET ramp_bars = 8 WHERE id = 1');
    const membership = readMembership(db);
    const presets = () =>
      rows<Record<string, unknown>>(
        db,
        'SELECT * FROM song_presets ORDER BY id',
      );
    const before = presets();
    expect(before.length).toBeGreaterThan(0);
    migrate(nodeSqliteDriver(db));
    expect(presets()).toEqual(
      before.map(({ ramp_bars, ...row }) => ({
        ...row,
        ramp_length: ramp_bars,
        ramp_unit: 0,
        ramp_loop: 0,
        ramp_step: 1,
        poly_against: 0,
      })),
    );
    expect(presets()[0]?.ramp_length).toBe(8);
    expect(readMembership(db)).toEqual(membership);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('never reuses a deleted preset id across the v12 rebuild', () => {
    const db = buildV11Fixture();
    const [last] = rows<{ id: number }>(
      db,
      'SELECT max(id) AS id FROM song_presets',
    );
    db.exec(`DELETE FROM song_presets WHERE id = ${String(last?.id)}`);
    migrate(nodeSqliteDriver(db));
    db.exec(
      "INSERT INTO song_presets (name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, uuid) VALUES ('New', 120, 1, 1, X'01', 0, 0, 0, 'n')",
    );
    const [created] = rows<{ id: number }>(
      db,
      "SELECT id FROM song_presets WHERE name = 'New'",
    );
    expect(created?.id).toBeGreaterThan(last?.id ?? 0);
  });

  it('drops v9 tunings the tuner could never load', () => {
    const db = buildV9Fixture();
    db.exec(`INSERT INTO tunings (name, notes, uuid) VALUES
      ('Unstrung', X'', 'a'),
      ('Thirteen', X'${'28'.repeat(13)}', 'b'),
      ('Out of range', X'2880', 'c'),
      ('Twelve', X'${'7F'.repeat(12)}', 'd')`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows<{ name: string }>(db, 'SELECT name FROM tunings ORDER BY id').map(
        (row) => row.name,
      ),
    ).toEqual(['Drop D', 'Twelve']);
  });

  it('gives a fresh database a non-null tunings.instrument defaulting to guitar', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    db.exec("INSERT INTO tunings (name, notes, uuid) VALUES ('A', X'28', 'a')");
    expect(rows(db, 'SELECT instrument FROM tunings')).toEqual([
      { instrument: 0 },
    ]);
    expect(() => {
      db.exec(
        "INSERT INTO tunings (name, notes, uuid, instrument) VALUES ('B', X'28', 'b', NULL)",
      );
    }).toThrow();
  });

  it('repairs v6 presets the engine would refuse, keeping their meaning', () => {
    const db = buildV6Fixture();
    migrate(nodeSqliteDriver(db));
    const presets = rows(
      db,
      "SELECT name || ' ' || bpm || ' ' || beats_per_bar || ' ' || sound || ' ' || poly_beats || ' ' || hex(accents) AS row FROM song_presets ORDER BY id",
    );
    expect(presets.map((preset) => (preset as { row: string }).row)).toEqual([
      'Opener 128.0 4 0 0 01010101',
      'Bridge 92.0 3 2 5 010101',
      'Ballad 72.0 4 1 0 01010101',
      `Out of range 400.0 16 5 16 0201${'01'.repeat(14)}`,
    ]);
  });

  it('refuses a practice session without a uuid on insert and update', () => {
    const db = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(db));
    const insert = (uuid: string | null) =>
      db
        .prepare(
          'INSERT INTO practice_sessions (start_time, duration_seconds, avg_bpm, uuid) VALUES (1, 1, 100, ?)',
        )
        .run(uuid);
    expect(() => insert(null)).toThrow('practice_sessions.uuid is required');
    insert(crypto.randomUUID());
    expect(() => {
      db.exec('UPDATE practice_sessions SET uuid = NULL');
    }).toThrow('practice_sessions.uuid is required');
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
