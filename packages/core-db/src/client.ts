import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import { createBackupService } from './backup';
import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';
import { createPreferences } from './preferences';
import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { createTransactor } from './transaction';
import { createTuningRepository } from './tuning-repository';

const DATABASE_NAME = 'kitbag';

export type Connection = Pick<
  DB,
  'close' | 'closeAsync' | 'execute' | 'executeSync' | 'executeRaw'
>;

type Params = Parameters<Connection['execute']>[1];

// drizzle-orm 0.45's op-sqlite session expects executeRawAsync to resolve to
// bare rows and execute() to answer synchronously with rows._array.
export function drizzleClient(connection: Connection) {
  return {
    executeAsync: (sql: string, params?: Params) =>
      connection.execute(sql, params),
    executeRawAsync: async (sql: string, params?: Params) =>
      (await connection.executeRaw(sql, params)).rawRows,
    execute: (sql: string, params?: Params) => ({
      rows: { _array: connection.executeSync(sql, params).rows },
    }),
  };
}

export function openDatabase(name: string = DATABASE_NAME) {
  return connectDatabase(open({ name }));
}

export function connectDatabase(connection: Connection) {
  try {
    migrate(opSqliteMigrationDriver(connection));
  } catch (error) {
    // The caller retries, so a failed open must not leave a connection behind.
    try {
      connection.close();
    } catch {
      // The migration error is the one worth reporting.
    }
    throw error;
  }
  const handle = {
    db: drizzle(drizzleClient(connection), { schema }),
    transactor: createTransactor((statement) => connection.execute(statement)),
  };
  return {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
    tunings: createTuningRepository(handle),
    backup: createBackupService(handle),
    preferences: createPreferences(
      (sql, params) => connection.executeSync(sql, params).rows,
      handle.transactor,
    ),
    close: () =>
      handle.transactor.serial(async () => {
        await connection.closeAsync();
      }),
  };
}

export type KitbagDatabase = ReturnType<typeof openDatabase>;
export type SetlistRepository = KitbagDatabase['setlists'];
export type SongPresetRepository = KitbagDatabase['presets'];

function opSqliteMigrationDriver(connection: Connection): MigrationDriver {
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
