import { describe, expect, it, vi } from 'vitest';

import type { Scalar } from '@op-engineering/op-sqlite';

import type { Connection } from './client';

const opened = vi.hoisted(() => [] as Connection[]);

vi.mock('@op-engineering/op-sqlite', async () => {
  const { fakeOpSqlite } = await import('./op-sqlite-fake.test-helper');
  return {
    open: () => {
      const { connection } = fakeOpSqlite();
      opened.push(connection);
      return connection;
    },
  };
});

import { connectDatabase, ForeignKeysOff, openDatabase } from './client';
import { memoryClickSoundFiles } from './click-sound-files.test-helper';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';

function openAppDatabase() {
  const database = openDatabase(memoryClickSoundFiles().files);
  const connection = opened.at(-1);
  if (connection === undefined) throw new Error('no connection opened');
  return { database, connection };
}

describe('the op-sqlite test fake', () => {
  it('opens with foreign keys off, as op-sqlite does, so the checks below can fail', () => {
    const { connection } = fakeOpSqlite();
    expect(connection.executeSync('PRAGMA foreign_keys').rows[0]).toEqual({
      foreign_keys: 0,
    });
  });
});

describe('foreign keys on the app connection', () => {
  it('refuse to open, and close the connection, when the pragma does not take', () => {
    const { connection } = fakeOpSqlite();
    const close = vi.spyOn(connection, 'close');
    const ignoringForeignKeys = {
      ...connection,
      executeSync: (sql: string, params?: Scalar[]) =>
        sql === 'PRAGMA foreign_keys = ON'
          ? { rowsAffected: 0, rows: [] }
          : connection.executeSync(sql, params),
    };
    expect(() =>
      connectDatabase(ignoringForeignKeys, memoryClickSoundFiles().files),
    ).toThrow(ForeignKeysOff);
    expect(close).toHaveBeenCalledOnce();
  });

  it('are on for the async reads and writes the repositories make', async () => {
    const { database, connection } = openAppDatabase();
    expect((await connection.execute('PRAGMA foreign_keys')).rows[0]).toEqual({
      foreign_keys: 1,
    });
    await database.close();
  });

  it('cascade a stem song delete into its setlist and queue entries', async () => {
    const { database, connection } = openAppDatabase();
    await connection.execute(
      "INSERT INTO stem_sets (id, name, created_at, uuid) VALUES (7, 'Redbone', 0, 'r')",
    );
    const gig = await database.setlists.create('Gig');
    await database.setlists.addStemSet(gig.id, 7);
    await database.playQueue.add(7);
    await connection.execute('DELETE FROM stem_sets WHERE id = 7');
    expect(await database.setlists.items(gig.id)).toEqual([]);
    expect(await database.playQueue.list()).toEqual([]);
    await database.close();
  });
});
