import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';
import { migrate, type MigrationDriver } from './migrate';
import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { createTransactor } from './transaction';

const DATABASE_NAME = 'kitbag';

export function openDatabase(name: string = DATABASE_NAME) {
  const connection = open({ name });
  migrate(opSqliteMigrationDriver(connection));
  const handle = {
    db: drizzle(connection, { schema }),
    transactor: createTransactor((statement) => connection.execute(statement)),
  };
  return {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
    close: () =>
      handle.transactor.serial(async () => {
        await connection.closeAsync();
      }),
  };
}

export type KitbagDatabase = ReturnType<typeof openDatabase>;
export type SetlistRepository = KitbagDatabase['setlists'];
export type SongPresetRepository = KitbagDatabase['presets'];

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
