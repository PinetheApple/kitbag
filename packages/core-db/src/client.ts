// op-sqlite + Drizzle wiring (SPEC §11.1). op-sqlite is JSI-backed, so queries
// do not cross the legacy bridge. This is the only place a DB connection is
// opened; the rest of core-db works against the drizzle `db` and the schema.
//
// NOT device-verified. This wiring typechecks against op-sqlite 17 and drizzle
// 0.45, but no query has run on a device yet — that rides with the Phase 2
// device gate (#33). The migration SQL itself IS verified headlessly (see
// migrate.test.ts); what is unproven here is only the op-sqlite binding.

import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';
import { type MigrationDriver } from './migrate';

/** The on-disk database name (op-sqlite resolves it under the app data dir). */
export const DATABASE_NAME = 'kitbag';

/** Open the app database and return a typed Drizzle client bound to the schema. */
export function openDatabase(name: string = DATABASE_NAME): {
  connection: DB;
  db: ReturnType<typeof drizzle<typeof schema>>;
} {
  const connection = open({ name });
  const db = drizzle(connection, { schema });
  return { connection, db };
}

/** Adapt an op-sqlite connection to the synchronous {@link MigrationDriver}. */
export function opSqliteMigrationDriver(connection: DB): MigrationDriver {
  return {
    exec: (sql) => {
      connection.executeSync(sql);
    },
    getUserVersion: () => {
      const result = connection.executeSync('PRAGMA user_version');
      const row = result.rows[0];
      const value = row?.user_version;
      return typeof value === 'number' ? value : 0;
    },
    setUserVersion: (version) => {
      // `version` is a trusted internal constant (SCHEMA_VERSION), never user input.
      connection.executeSync(`PRAGMA user_version = ${String(version)}`);
    },
  };
}
