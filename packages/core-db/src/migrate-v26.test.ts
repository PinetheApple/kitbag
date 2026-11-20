import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV25Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const INSERT_SESSION = `INSERT INTO practice_sessions
  (start_time, duration_seconds, avg_bpm, songs_played, uuid)
  VALUES (1700000000, 600, 96, '["p"]', 's')`;

const practiceShape = (db: DatabaseSync) => ({
  columns: rows(db, 'PRAGMA table_info(practice_sessions)'),
  indexes: rows(
    db,
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'practice_sessions' ORDER BY name",
  ),
});

function upgraded() {
  const db = buildV25Fixture();
  db.exec(INSERT_SESSION);
  const before = rows<Record<string, unknown>>(
    db,
    'SELECT * FROM practice_sessions ORDER BY id',
  );
  migrate(nodeSqliteDriver(db));
  return { db, before };
}

describe('migrate v25 to v26', () => {
  it('gives an upgraded database the practice shape of a fresh one', () => {
    const fresh = new DatabaseSync(':memory:');
    migrate(nodeSqliteDriver(fresh));
    const { db } = upgraded();
    expect(practiceShape(db)).toEqual(practiceShape(fresh));
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('keeps every earlier session, with no log', () => {
    const { db, before } = upgraded();
    expect(before.length).toBeGreaterThan(0);
    const names = new Map(
      rows<{ id: number; name: string }>(
        db,
        'SELECT id, name FROM setlists',
      ).map(({ id, name }) => [id, name]),
    );
    expect(rows(db, 'SELECT * FROM practice_sessions ORDER BY id')).toEqual(
      before.map((row) => ({
        ...row,
        log: null,
        setlist_name: names.get(Number(row.setlist_id)) ?? null,
      })),
    );
  });

  it('names each earlier session after the setlist it still links to', () => {
    const db = buildV25Fixture();
    db.exec(
      "INSERT INTO setlists (id, name, uuid) VALUES (900, 'Wedding', 'w')",
    );
    db.exec(`INSERT INTO practice_sessions
      (start_time, duration_seconds, avg_bpm, setlist_id, uuid)
      VALUES (1, 60, 96, 900, 'linked'), (2, 60, 96, NULL, 'unlinked')`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows(
        db,
        "SELECT uuid, setlist_name FROM practice_sessions WHERE uuid IN ('linked', 'unlinked') ORDER BY uuid",
      ),
    ).toEqual([
      { uuid: 'linked', setlist_name: 'Wedding' },
      { uuid: 'unlinked', setlist_name: null },
    ]);
  });

  it('reads sessions newest first through the start time index', () => {
    const { db } = upgraded();
    const plan = rows<{ detail: string }>(
      db,
      'EXPLAIN QUERY PLAN SELECT uuid FROM practice_sessions ORDER BY start_time DESC, id DESC',
    );
    expect(plan.map((step) => step.detail).join(' ')).toContain(
      'practice_sessions_start_time',
    );
  });
});
