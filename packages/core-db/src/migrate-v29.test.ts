import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV28Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const PLAY_QUEUE_COLUMNS = [
  { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
  { name: 'stem_set_id', type: 'INTEGER', notnull: 0, pk: 0 },
  { name: 'song_id', type: 'INTEGER', notnull: 0, pk: 0 },
  { name: 'position', type: 'INTEGER', notnull: 1, pk: 0 },
];

const columns = (db: DatabaseSync) =>
  rows<{ name: string; type: string; notnull: number; pk: number }>(
    db,
    'PRAGMA table_info(play_queue)',
  ).map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));

const insertStemSet = (db: DatabaseSync, id: number) => {
  db.exec(`INSERT INTO stem_sets (id, name, created_at, uuid)
    VALUES (${String(id)}, 'Stems ${String(id)}', 0, 's${String(id)}')`);
};

const insertSong = (db: DatabaseSync, id: number) => {
  db.exec(`INSERT INTO songs (id, title, artist, file_path, duration, format, created_at, uuid)
    VALUES (${String(id)}, 'Song', '', 'songs/s.mp3', 1, 'mp3', 0, 'u${String(id)}')`);
};

const queue = (stem: string, song: string, position = 0) =>
  `INSERT INTO play_queue (stem_set_id, song_id, position)
   VALUES (${stem}, ${song}, ${String(position)})`;

function v28WithQueue() {
  const db = buildV28Fixture();
  insertStemSet(db, 1);
  insertStemSet(db, 2);
  db.exec('INSERT INTO play_queue (stem_set_id, position) VALUES (2, 0)');
  db.exec('INSERT INTO play_queue (stem_set_id, position) VALUES (1, 1)');
  db.exec('DELETE FROM play_queue WHERE stem_set_id = 1');
  db.exec('INSERT INTO play_queue (stem_set_id, position) VALUES (1, 1)');
  return db;
}

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  migrate(nodeSqliteDriver(db));
  insertStemSet(db, 1);
  insertSong(db, 1);
  return db;
}

describe('migrate v28 to v29', () => {
  it('keeps every queued stem song, its order and the id sequence', () => {
    const db = v28WithQueue();
    const [sequence] = rows(
      db,
      "SELECT seq FROM sqlite_sequence WHERE name = 'play_queue'",
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM play_queue ORDER BY position, id')).toEqual([
      { id: 1, stem_set_id: 2, song_id: null, position: 0 },
      { id: 3, stem_set_id: 1, song_id: null, position: 1 },
    ]);
    expect(
      rows(db, "SELECT seq FROM sqlite_sequence WHERE name = 'play_queue'"),
    ).toEqual([sequence]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('keys the queue by a stem song or a single song, on upgrade and fresh', () => {
    const upgraded = v28WithQueue();
    migrate(nodeSqliteDriver(upgraded));
    expect(columns(upgraded)).toEqual(PLAY_QUEUE_COLUMNS);
    expect(columns(freshDatabase())).toEqual(PLAY_QUEUE_COLUMNS);
  });

  it.each([
    ['neither a song nor a stem song', 'NULL', 'NULL'],
    ['both a song and a stem song', '1', '1'],
  ])('refuses a queue entry that is %s', (_, stem, song) => {
    const db = freshDatabase();
    expect(() => {
      db.exec(queue(stem, song));
    }).toThrow(/CHECK/);
  });

  it.each([
    ['stem song', '1', 'NULL'],
    ['single song', 'NULL', '1'],
  ])('queues a %s once', (_, stem, song) => {
    const db = freshDatabase();
    db.exec(queue(stem, song));
    expect(() => {
      db.exec(queue(stem, song, 1));
    }).toThrow(/UNIQUE/);
  });

  it('drops a deleted song or stem song from the queue', () => {
    const db = freshDatabase();
    insertSong(db, 2);
    db.exec(queue('1', 'NULL'));
    db.exec(queue('NULL', '1', 1));
    db.exec(queue('NULL', '2', 2));
    db.exec('DELETE FROM songs WHERE id = 1');
    db.exec('DELETE FROM stem_sets WHERE id = 1');
    expect(rows(db, 'SELECT stem_set_id, song_id FROM play_queue')).toEqual([
      { stem_set_id: null, song_id: 2 },
    ]);
  });
});
