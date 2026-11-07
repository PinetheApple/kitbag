import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Scalar } from '@op-engineering/op-sqlite';

import type { Connection } from './client';

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

function onMacrotask<T>(work: () => T): Promise<T> {
  return new Promise<void>((resolve) => setImmediate(resolve)).then(work);
}

// Mirrors op-sqlite 18.2.5: enhanceDB() in src/functions.ts over create_js_rows and
// create_raw_result in cpp/OPUtils.cpp; async calls settle on a later macrotask.
export function fakeOpSqlite() {
  const sqlite = new DatabaseSync(':memory:');
  const lastWrite = sqlite.prepare(
    'SELECT changes() AS changes, last_insert_rowid() AS rowid',
  );

  function run(sql: string, params: Scalar[] = []) {
    const statement = sqlite.prepare(sql);
    const values = params.map(toSqlValue);
    const columnNames = statement.columns().map((column) => column.name);
    let rows: ReturnType<typeof statement.all> = [];
    if (columnNames.length > 0) rows = statement.all(...values);
    else statement.run(...values);
    const { changes, rowid } = lastWrite.get() as {
      changes: number;
      rowid: number;
    };
    return {
      rowsAffected: changes,
      insertId: rowid,
      rawRows: rows.map((row) =>
        columnNames.map((name) => fromSqlValue(row[name])),
      ),
      columnNames,
    };
  }

  function objects(sql: string, params?: Scalar[]) {
    const { rowsAffected, insertId, columnNames, rawRows } = run(sql, params);
    const rows = rawRows.map((raw) =>
      Object.fromEntries(columnNames.map((name, i) => [name, raw[i] ?? null])),
    );
    return rowsAffected > 0 && insertId !== 0
      ? { rowsAffected, insertId, rows }
      : { rowsAffected, rows };
  }

  const connection = {
    executeSync: objects,
    execute: (sql: string, params?: Scalar[]) =>
      onMacrotask(() => objects(sql, params)),
    executeRawSync: run,
    executeRaw: (sql: string, params?: Scalar[]) =>
      onMacrotask(() => run(sql, params)),
    executeAsync: (sql: string, params?: Scalar[]) =>
      onMacrotask(() => objects(sql, params)),
    executeRawAsync: (sql: string, params?: Scalar[]) =>
      onMacrotask(() => run(sql, params)),
    close: () => {
      sqlite.close();
    },
    closeAsync: () =>
      onMacrotask(() => {
        sqlite.close();
      }),
  } satisfies Connection & Record<string, unknown>;
  return { connection };
}
