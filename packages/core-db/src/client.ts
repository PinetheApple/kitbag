import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';
import type { DatabaseHandle } from './repository';
import { createTransactor } from './transaction';

const DATABASE_NAME = 'kitbag';

export function openDatabase(
  name: string = DATABASE_NAME,
): DatabaseHandle & { connection: DB } {
  const connection = open({ name });
  migrate(opSqliteMigrationDriver(connection));
  const db = drizzle(connection, { schema });
  const transactor = createTransactor((statement) =>
    connection.execute(statement),
  );
  return { connection, db, transactor };
}

function opSqliteMigrationDriver(connection: DB): MigrationDriver {
  return {
    exec: (sql) => {
      connection.executeSync(sql);
    },
    getUserVersion: () => {
      const value = connection.executeSync('PRAGMA user_version').rows[0]
        ?.user_version;
      return typeof value === 'number' ? value : 0;
    },
    setUserVersion: (version) => {
      connection.executeSync(`PRAGMA user_version = ${String(version)}`);
    },
  };
}
