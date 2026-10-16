import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Connection } from './client';

type Scalar = string | number | boolean | null | ArrayBuffer | ArrayBufferView;

function toSqlValue(value: Scalar | undefined): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return value;
}

function fromSqlValue(value: unknown): Scalar {
  if (value instanceof Uint8Array)
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
  return value as Scalar;
}

// Mirrors op-sqlite 17.1.2's enhanceDB(): its typed API plus the two untyped
// wrappers it keeps for drizzle (src/functions.ts), so failures match the device.
export function fakeOpSqlite() {
  const sqlite = new DatabaseSync(':memory:');

  function run(sql: string, params: Scalar[] = []) {
    const statement = sqlite.prepare(sql);
    const values = params.map(toSqlValue);
    const columnNames = statement.columns().map((column) => column.name);
    const outcome =
      columnNames.length > 0
        ? { rows: statement.all(...values), changes: 0, lastInsertRowid: 0 }
        : { rows: [], ...statement.run(...values) };
    const rawRows = outcome.rows.map((row) =>
      columnNames.map((name) => fromSqlValue(row[name])),
    );
    return {
      rowsAffected: Number(outcome.changes),
      insertId: Number(outcome.lastInsertRowid),
      columnNames,
      rawRows,
    };
  }

  function objects(sql: string, params?: Scalar[]) {
    const { rowsAffected, insertId, columnNames, rawRows } = run(sql, params);
    const rows = rawRows.map((raw) =>
      Object.fromEntries(columnNames.map((name, i) => [name, raw[i] ?? null])),
    );
    return { rowsAffected, insertId, rows };
  }

  const connection = {
    executeSync: objects,
    execute: (sql: string, params?: Scalar[]) =>
      Promise.resolve(objects(sql, params)),
    executeRawSync: run,
    executeRaw: (sql: string, params?: Scalar[]) =>
      Promise.resolve(run(sql, params)),
    executeAsync: (sql: string, params?: Scalar[]) =>
      Promise.resolve(objects(sql, params)),
    executeRawAsync: (sql: string, params?: Scalar[]) =>
      Promise.resolve(run(sql, params)),
    close: () => {
      sqlite.close();
    },
    closeAsync: () => {
      sqlite.close();
      return Promise.resolve();
    },
  } satisfies Connection & Record<string, unknown>;
  return { connection };
}
