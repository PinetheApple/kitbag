/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';

export function openTestDatabase() {
  const connection = new DatabaseSync(':memory:');
  const driver: MigrationDriver = {
    exec: (sql) => {
      connection.exec(sql);
    },
    getUserVersion: () => {
      const row = connection.prepare('PRAGMA user_version').get() as {
        user_version?: number;
      };
      return row.user_version ?? 0;
    },
    setUserVersion: (version) => {
      connection.exec(`PRAGMA user_version = ${String(version)}`);
    },
  };
  migrate(driver);
  const db = drizzle(
    async (sql, params, method) => {
      const statement = connection.prepare(sql);
      const values = params.map((param) => param ?? null);
      if (method === 'run') {
        statement.run(...values);
        return { rows: [] };
      }
      if (method === 'get') {
        const row = statement.get(...values) as
          Record<string, unknown> | undefined;
        return { rows: row ? [Object.values(row)] : [] };
      }
      const rows = statement.all(...values) as Record<string, unknown>[];
      return { rows: rows.map((row) => Object.values(row)) };
    },
    { schema },
  );
  return { connection, db };
}
