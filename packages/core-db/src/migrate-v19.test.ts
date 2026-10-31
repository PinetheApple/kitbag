import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import {
  buildV17Fixture,
  buildV18Fixture,
  pragma,
  rows,
} from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

const HEADPHONES = 'bt-a2dp:headphones';

describe('migrate v18 to v19', () => {
  it('keeps every stored route offset and leaves its name and kind unknown', () => {
    const db = buildV18Fixture();
    db.exec(`INSERT INTO route_latency (route, offset_ms)
      VALUES ('speaker', 0), ('${HEADPHONES}', 182.5)`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows(db, 'SELECT route, offset_ms, name, kind FROM route_latency'),
    ).toEqual([
      { route: 'speaker', offset_ms: 0, name: null, kind: null },
      { route: HEADPHONES, offset_ms: 182.5, name: null, kind: null },
    ]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('runs v17 through v18 to v19, keeping the poly cycle and the routes', () => {
    const db = buildV17Fixture();
    db.exec(`INSERT INTO route_latency (route, offset_ms) VALUES ('wired', 4)`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows(
        db,
        'SELECT count(*) AS n FROM song_presets WHERE poly_against IS NULL',
      ),
    ).toEqual([{ n: 0 }]);
    expect(rows(db, 'SELECT route, kind FROM route_latency')).toEqual([
      { route: 'wired', kind: null },
    ]);
  });
});
