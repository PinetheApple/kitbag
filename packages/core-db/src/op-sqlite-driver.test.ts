import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { connectDatabase, drizzleClient } from './client';
import { presetValues } from './backup.test-helper';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';
import { INSTRUMENTS } from './tuning-rules';

describe('drizzle over the op-sqlite 17 connection', () => {
  it('runs repository reads and writes', async () => {
    const database = connectDatabase(fakeOpSqlite().connection);

    const setlist = await database.setlists.create('Friday');
    expect(await database.setlists.list()).toEqual([setlist]);

    const preset = await database.presets.create(presetValues('Opener', null));
    expect(await database.presets.list()).toEqual([preset]);
    expect(await database.presets.get(preset.id)).toEqual(preset);

    await database.setlists.add(setlist.id, preset.id);
    await database.setlists.selectActive(setlist.id);
    expect(await database.setlists.items(setlist.id)).toHaveLength(1);
    expect(await database.setlists.active()).toMatchObject({ id: setlist.id });

    const tuning = await database.tunings.create({
      name: 'Open G',
      instrument: INSTRUMENTS.guitar,
      notes: [38, 43, 50, 55, 59, 62],
    });
    expect(await database.tunings.list()).toEqual([tuning]);

    await database.close();
  });

  it('serves run, all, get and values for raw SQL', async () => {
    const { connection } = fakeOpSqlite();
    const db = drizzle(drizzleClient(connection));

    await db.run(sql`CREATE TABLE t (n INTEGER, s TEXT)`);
    await db.run(sql`INSERT INTO t VALUES (${1}, ${'a'}), (${2}, ${'b'})`);

    expect(await db.all(sql`SELECT n, s FROM t ORDER BY n`)).toEqual([
      { n: 1, s: 'a' },
      { n: 2, s: 'b' },
    ]);
    expect(await db.get(sql`SELECT s FROM t WHERE n = ${2}`)).toEqual({
      s: 'b',
    });
    expect(await db.values(sql`SELECT n, s FROM t ORDER BY n`)).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });
});
