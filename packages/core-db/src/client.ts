import type { DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import { attempt } from './attempt';
import { createBackupService } from './backup';
import { createBpmCacheRepository } from './bpm-cache-repository';
import type { ClickSoundFiles } from './click-sound-files';
import { createClickSoundRepository } from './click-sound-repository';
import { DatabaseOpenError } from './database-open-error';
import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';
import {
  copyBeforeMigration,
  type MigrationCopyFiles,
  type MigrationCopySql,
} from './migration-copy';
import { openConnection } from './openConnection';
import { createPlayQueueRepository } from './play-queue-repository';
import { createPracticeRepository } from './practice-repository';
import { createPreferences } from './preferences';
import { createRouteLatencyRepository } from './route-latency-repository';
import { createSetlistRepository } from './setlist-repository';
import { createSongLibraryRepository } from './song-library-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { createToolDataRepository } from './tool-data-repository';
import { createTransactor } from './transaction';
import { createTuningRepository } from './tuning-repository';

export const DATABASE_NAME = 'kitbag';

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

export function openDatabase(
  clickSoundFiles: ClickSoundFiles,
  migrationCopyFiles: MigrationCopyFiles,
  name: string = DATABASE_NAME,
) {
  return connectDatabase(
    openNativeConnection(name),
    clickSoundFiles,
    migrationCopyFiles,
  );
}

function openNativeConnection(name: string): Connection {
  try {
    return openConnection(name);
  } catch (error) {
    throw DatabaseOpenError.classify('open', error);
  }
}

function requireForeignKeys(connection: Connection): void {
  let enabled: unknown;
  try {
    enabled = connection.executeSync('PRAGMA foreign_keys').rows[0]
      ?.foreign_keys;
  } catch (error) {
    throw DatabaseOpenError.classify('foreign-keys', error);
  }
  if (enabled !== 1) throw new DatabaseOpenError('foreign-keys');
}

export function connectDatabase(
  connection: Connection,
  clickSoundFiles: ClickSoundFiles,
  migrationCopyFiles: MigrationCopyFiles,
) {
  try {
    migrate(opSqliteMigrationDriver(connection), (fromVersion) => {
      copyBeforeMigration(
        opSqliteCopySql(connection),
        migrationCopyFiles,
        fromVersion,
      );
    });
    requireForeignKeys(connection);
  } catch (error) {
    // The caller retries, so a failed open must not leave a connection behind.
    const closeErrors = attempt(() => {
      connection.close();
    });
    throw error instanceof DatabaseOpenError
      ? error.withCleanupErrors(closeErrors)
      : DatabaseOpenError.classify('open', error, {
          cleanupErrors: closeErrors,
        });
  }
  const handle = {
    db: drizzle(drizzleClient(connection), { schema }),
    transactor: createTransactor((statement) => connection.execute(statement)),
  };
  return {
    setlists: createSetlistRepository(handle),
    playQueue: createPlayQueueRepository(handle),
    presets: createSongPresetRepository(handle),
    tunings: createTuningRepository(handle),
    songLibrary: createSongLibraryRepository(handle),
    backup: createBackupService(handle, clickSoundFiles),
    clickSounds: createClickSoundRepository(handle),
    practice: createPracticeRepository(handle),
    routeLatency: createRouteLatencyRepository(handle),
    bpmCache: createBpmCacheRepository(handle),
    toolData: createToolDataRepository(handle),
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

function opSqliteCopySql(connection: Connection): MigrationCopySql {
  return {
    exec: (sql) => {
      connection.executeSync(sql);
    },
    value: (sql) => {
      const [row] = connection.executeSync(sql).rows;
      return row === undefined ? undefined : Object.values(row)[0];
    },
  };
}

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
