import { describe, expect, it } from 'vitest';

import { migrate, SCHEMA_VERSION } from './migrate';
import { buildV17Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';

describe('migrate v17 to v18', () => {
  it('keeps every stored route offset and leaves its name and kind unknown', () => {
    const db = buildV17Fixture();
    db.exec(`INSERT INTO route_latency (route, offset_ms)
      VALUES ('speaker', 0), ('bt-a2dp:EE:FF:WH-1000XM4', 182.5)`);
    migrate(nodeSqliteDriver(db));
    expect(
      rows(db, 'SELECT route, offset_ms, name, kind FROM route_latency'),
    ).toEqual([
      { route: 'speaker', offset_ms: 0, name: null, kind: null },
      {
        route: 'bt-a2dp:EE:FF:WH-1000XM4',
        offset_ms: 182.5,
        name: null,
        kind: null,
      },
    ]);
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });
});
