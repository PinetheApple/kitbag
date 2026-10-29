import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV15Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

describe('migrate v15 to v16', () => {
  it('keeps every stem set and gives it an empty song title and artist', () => {
    const db = buildV15Fixture();
    db.exec(`INSERT INTO stem_sets (id, name, created_at, uuid, source, stemdeck_job_id)
      VALUES (1, 'Charity Gayle - Echo', 1700000000, 's', 'stemdeck', 'job')`);
    const sets = () => rows(db, 'SELECT * FROM stem_sets ORDER BY id');
    const before = sets();
    migrate(nodeSqliteDriver(db));
    expect(sets()).toEqual(
      before.map((row) => ({
        ...(row as object),
        song_title: null,
        artist: null,
        renamed: 0,
      })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });
});
