import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV24Fixture,
  buildV25Fixture,
  pragma,
  rows,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const PLAY_QUEUE_COLUMNS = [
  { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
  { name: 'stem_set_id', type: 'INTEGER', notnull: 1, pk: 0 },
  { name: 'position', type: 'INTEGER', notnull: 1, pk: 0 },
];

const columns = (db: DatabaseSync, table: string) =>
  rows<{ name: string; type: string; notnull: number; pk: number }>(
    db,
    `PRAGMA table_info(${table})`,
  ).map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  migrate(nodeSqliteDriver(db));
  db.exec(`INSERT INTO setlists (id, name, uuid) VALUES (1, 'Gig', 'g')`);
  db.exec(`INSERT INTO song_presets
    (id, name, bpm, beats_per_bar, subdivision, accents, poly_enabled, poly_beats, sound, uuid)
    VALUES (1, 'Opener', 120, 4, 1, X'02010101', 0, 0, 0, 'p')`);
  db.exec(`INSERT INTO stem_sets (id, name, created_at, uuid)
    VALUES (1, 'Redbone', 1700000000, 's')`);
  return db;
}

const insertItem = (preset: string, stem: string) =>
  `INSERT INTO setlist_items (setlist_id, song_preset_id, stem_set_id, position)
   VALUES (1, ${preset}, ${stem}, 0)`;

describe('migrate v24 to v25', () => {
  it('keeps every setlist item as a metronome entry and its id sequence', () => {
    const db = buildV24Fixture();
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM setlist_items ORDER BY id',
    );
    expect(before.length).toBeGreaterThan(0);
    const [sequence] = rows(
      db,
      "SELECT seq FROM sqlite_sequence WHERE name = 'setlist_items'",
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM setlist_items ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, stem_set_id: null })),
    );
    expect(
      rows(db, "SELECT seq FROM sqlite_sequence WHERE name = 'setlist_items'"),
    ).toEqual([sequence]);
    expect(rows(db, 'SELECT * FROM play_queue')).toEqual([]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('never reuses the id of a deleted setlist item', () => {
    const db = buildV24Fixture();
    const [last] = rows<{ id: number }>(
      db,
      'SELECT max(id) AS id FROM setlist_items',
    );
    db.exec('DELETE FROM setlist_items');
    migrate(nodeSqliteDriver(db));
    db.exec(insertItem('1', 'NULL'));
    const [created] = rows<{ id: number }>(db, 'SELECT id FROM setlist_items');
    expect(created?.id).toBeGreaterThan(last?.id ?? 0);
  });

  it('gives the database an ordered play queue', () => {
    expect(columns(buildV25Fixture(), 'play_queue')).toEqual(
      PLAY_QUEUE_COLUMNS,
    );
  });

  it.each([
    ['neither a song nor a stem song', 'NULL', 'NULL'],
    ['both a song and a stem song', '1', '1'],
  ])('refuses a setlist entry that is %s', (_, preset, stem) => {
    const db = freshDatabase();
    expect(() => {
      db.exec(insertItem(preset, stem));
    }).toThrow(/CHECK/);
  });

  it('holds a metronome entry or a stem entry', () => {
    const db = freshDatabase();
    db.exec(insertItem('1', 'NULL'));
    db.exec(insertItem('NULL', '1'));
    expect(rows(db, 'SELECT count(*) AS n FROM setlist_items')).toEqual([
      { n: 2 },
    ]);
  });

  it('queues a stem song once', () => {
    const db = freshDatabase();
    const queue =
      'INSERT INTO play_queue (stem_set_id, position) VALUES (1, 0)';
    db.exec(queue);
    expect(() => {
      db.exec(queue);
    }).toThrow(/UNIQUE/);
  });

  it('drops a deleted stem song from setlists and the queue', () => {
    const db = freshDatabase();
    db.exec(insertItem('1', 'NULL'));
    db.exec(insertItem('NULL', '1'));
    db.exec('INSERT INTO play_queue (stem_set_id, position) VALUES (1, 0)');
    db.exec('DELETE FROM stem_sets WHERE id = 1');
    expect(
      rows(db, 'SELECT song_preset_id, stem_set_id FROM setlist_items'),
    ).toEqual([{ song_preset_id: 1, stem_set_id: null }]);
    expect(rows(db, 'SELECT * FROM play_queue')).toEqual([]);
  });
});
