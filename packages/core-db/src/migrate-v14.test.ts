import { describe, expect, it } from 'vitest';

import { ANALYSIS_STATUSES } from './analysis-status';
import { migrate, MIGRATE_V13_TO_V14, SCHEMA_VERSION } from './migrate';
import { buildV13Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

describe('migrate v13 to v14', () => {
  it('upgrades a v13 database, marking only songs with a grid as analyzed', () => {
    const db = buildV13Fixture();
    db.exec(`INSERT INTO songs (title, artist, file_path, duration, format, created_at, beat_grid, uuid)
      VALUES ('Gridded', 'Someone', 'songs/g.mp3', 200, 'mp3', 1700000000, X'0000003f', 'g')`);
    const songs = () => rows(db, 'SELECT * FROM songs ORDER BY id');
    const before = songs();
    migrate(nodeSqliteDriver(db));
    expect(songs()).toEqual(
      before.map((row) => ({
        ...(row as object),
        analysis_status: expect.any(String) as unknown,
        analysis_error: null,
      })),
    );
    expect(
      rows(db, 'SELECT title, analysis_status FROM songs ORDER BY id'),
    ).toEqual([
      { title: 'Reference', analysis_status: 'pending' },
      { title: 'Gridded', analysis_status: 'done' },
    ]);
    db.exec("UPDATE songs SET analysis_status = 'analyzing' WHERE uuid = 'g'");
    expect(() => {
      db.exec("UPDATE songs SET analysis_status = 'unknown'");
    }).toThrow();
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('accepts exactly the statuses the app writes', () => {
    const [addStatus] = MIGRATE_V13_TO_V14;
    const allowed = /IN \(([^)]*)\)/.exec(addStatus ?? '')?.[1];
    expect(allowed?.split(', ').map((v) => v.replace(/'/g, ''))).toEqual(
      ANALYSIS_STATUSES,
    );
  });
});
