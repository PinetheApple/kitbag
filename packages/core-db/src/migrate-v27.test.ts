import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV26Fixture,
  pragma,
  rows,
  V32_MANUAL_TEMPO_COLUMNS,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const LOWEST_KEY = -6;
const HIGHEST_KEY = 6;

const insertSet = (id: number) =>
  `INSERT INTO stem_sets (id, name, created_at, uuid)
   VALUES (${String(id)}, 'Echo', 1700000000, 'u${String(id)}')`;

const setPitch = (db: DatabaseSync, pitch: number) => {
  db.exec(`UPDATE stem_sets SET pitch = ${String(pitch)} WHERE id = 1`);
};

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  migrate(nodeSqliteDriver(db));
  db.exec(insertSet(1));
  return db;
}

describe('migrate v26 to v27', () => {
  it('gives every existing stem song the unshifted song key and keeps the rest', () => {
    const db = buildV26Fixture();
    db.exec(insertSet(1));
    db.exec(insertSet(2));
    const before = rows<Record<string, unknown>>(
      db,
      'SELECT * FROM stem_sets ORDER BY id',
    );
    migrate(nodeSqliteDriver(db));
    expect(rows(db, 'SELECT * FROM stem_sets ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, pitch: 0, ...V32_MANUAL_TEMPO_COLUMNS })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it.each([LOWEST_KEY, 0, HIGHEST_KEY])('stores a song key of %i', (pitch) => {
    const db = freshDatabase();
    setPitch(db, pitch);
    expect(rows(db, 'SELECT pitch FROM stem_sets')).toEqual([{ pitch }]);
  });

  it.each([LOWEST_KEY - 1, HIGHEST_KEY + 1])(
    'refuses a song key of %i',
    (pitch) => {
      const db = freshDatabase();
      expect(() => {
        setPitch(db, pitch);
      }).toThrow(/CHECK/);
    },
  );
});
