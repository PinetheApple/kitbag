import { describe, expect, it } from 'vitest';

import { fakeOpSqlite } from './op-sqlite-fake.test-helper';

function seeded() {
  const { connection } = fakeOpSqlite();
  connection.executeSync(
    'CREATE TABLE t (id INTEGER PRIMARY KEY, s TEXT, b BLOB)',
  );
  return connection;
}

describe('the op-sqlite 18.2.5 fake', () => {
  it('omits insertId from executeSync until a write changes a row', () => {
    const connection = seeded();
    expect(connection.executeSync('PRAGMA user_version')).toStrictEqual({
      rowsAffected: 0,
      rows: [{ user_version: 0 }],
    });
    expect(
      connection.executeSync('INSERT INTO t (s) VALUES (?)', ['a']),
    ).toStrictEqual({ rowsAffected: 1, insertId: 1, rows: [] });
  });

  it('reports the previous write on a later read, as sqlite3_changes does', () => {
    const connection = seeded();
    connection.executeSync("INSERT INTO t (s) VALUES ('a'), ('b')");
    expect(connection.executeSync('SELECT s FROM t ORDER BY id')).toStrictEqual(
      { rowsAffected: 2, insertId: 2, rows: [{ s: 'a' }, { s: 'b' }] },
    );
  });

  it('returns RETURNING rows with the write counts', () => {
    const connection = seeded();
    expect(
      connection.executeSync("INSERT INTO t (s) VALUES ('a') RETURNING id"),
    ).toStrictEqual({ rowsAffected: 1, insertId: 1, rows: [{ id: 1 }] });
  });

  it('always carries insertId and columnNames on executeRaw', async () => {
    const connection = seeded();
    expect(await connection.executeRaw('SELECT s FROM t')).toStrictEqual({
      rowsAffected: 0,
      insertId: 0,
      rawRows: [],
      columnNames: ['s'],
    });
  });

  it('binds a Uint8Array and reads the blob back as an ArrayBuffer', async () => {
    const connection = seeded();
    connection.executeSync('INSERT INTO t (b) VALUES (?)', [
      new Uint8Array([2, 1, 0]),
    ]);
    const raw = (await connection.executeRaw('SELECT b FROM t')).rawRows[0];
    const objects = connection.executeSync('SELECT b FROM t').rows[0];
    for (const value of [raw?.[0], objects?.b]) {
      expect(value).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(value as ArrayBuffer)).toEqual(
        new Uint8Array([2, 1, 0]),
      );
    }
  });

  it('rejects rather than throws from the async methods', async () => {
    const { connection } = fakeOpSqlite();
    const calls = [
      () => connection.execute('SELECT * FROM missing'),
      () => connection.executeRaw('SELECT * FROM missing'),
      () => connection.executeAsync('SELECT * FROM missing'),
      () => connection.executeRawAsync('SELECT * FROM missing'),
    ];
    for (const call of calls) {
      let pending: Promise<unknown> | undefined;
      expect(() => {
        pending = call();
      }).not.toThrow();
      await expect(pending).rejects.toThrow();
    }
  });

  it('refuses statements after close', async () => {
    const { connection } = fakeOpSqlite();
    await connection.closeAsync();
    expect(() => connection.executeSync('SELECT 1')).toThrow();
    await expect(connection.execute('SELECT 1')).rejects.toThrow();
  });
});
