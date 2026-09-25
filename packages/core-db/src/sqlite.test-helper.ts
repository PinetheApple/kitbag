import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';
import { createTransactor } from './transaction';

type Method = 'run' | 'all' | 'values' | 'get';

export function nodeSqliteDriver(connection: DatabaseSync): MigrationDriver {
  return {
    exec: (sql) => {
      connection.exec(sql);
    },
    getUserVersion: () => {
      const value = connection
        .prepare('PRAGMA user_version')
        .get()?.user_version;
      return typeof value === 'number' ? value : 0;
    },
    setUserVersion: (version) => {
      connection.exec(`PRAGMA user_version = ${String(version)}`);
    },
  };
}

function toSqlValue(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'string' ||
    value instanceof Uint8Array
  )
    return value;
  throw new TypeError(`Unsupported SQL parameter type: ${typeof value}`);
}

function runQuery(
  connection: DatabaseSync,
  sql: string,
  params: unknown[],
  method: Method,
): unknown[] {
  const statement = connection.prepare(sql);
  const values = params.map(toSqlValue);
  if (method === 'run') {
    statement.run(...values);
    return [];
  }
  if (method === 'get') {
    const row = statement.get(...values);
    return row ? Object.values(row) : [];
  }
  return statement.all(...values).map((row) => Object.values(row));
}

export function openTestDatabase({ foreignKeys = true } = {}) {
  const connection = new DatabaseSync(':memory:');
  migrate(nodeSqliteDriver(connection));
  if (!foreignKeys) connection.exec('PRAGMA foreign_keys = OFF');
  const db = drizzle(
    (sql, params: unknown[], method) =>
      Promise.resolve({ rows: runQuery(connection, sql, params, method) }),
    { schema },
  );
  const transactor = createTransactor((statement) => {
    connection.exec(statement);
  });
  return { connection, db, transactor };
}
