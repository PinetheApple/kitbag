import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV16Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

describe('migrate v16 to v17', () => {
  it('keeps every stem set and stem, none of them renamed', () => {
    const db = buildV16Fixture();
    db.exec(`INSERT INTO stem_sets (id, name, created_at, uuid, source, stemdeck_job_id)
      VALUES (1, 'Charity Gayle - Echo', 1700000000, 's', 'stemdeck', 'job')`);
    db.exec(`INSERT INTO stems (id, stem_set_id, role, file_path, duration, format,
      channel_count, sample_rate, gain, muted, soloed, sort_order)
      VALUES (1, 1, 'other', 'stems/job/other.flac', 200, 'flac', 2, 44100, 1, 0, 0, 0)`);
    const sets = () => rows(db, 'SELECT * FROM stem_sets ORDER BY id');
    const stemRows = () => rows(db, 'SELECT * FROM stems ORDER BY id');
    const beforeSets = sets();
    const beforeStems = stemRows();
    migrate(nodeSqliteDriver(db));
    expect(sets()).toEqual(
      beforeSets.map((row) => ({ ...(row as object), renamed: 0 })),
    );
    expect(stemRows()).toEqual(
      beforeStems.map((row) => ({ ...(row as object), name: null })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });
});
