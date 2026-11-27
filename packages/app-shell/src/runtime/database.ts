import {
  DATABASE_NAME,
  DatabaseOpenError,
  openDatabase,
  type BackupRules,
  type KitbagDatabase,
  type MigrationCopyFiles,
} from '@kitbag/core-db';
import {
  databaseFreeBytes,
  KB_FIXED_OUTPUT_ROUTES,
  KB_LATENCY_OFFSET_MS_BOUNDS,
  deleteClickSound,
  readClickSound,
  removeDatabaseCopy,
  replaceDatabaseCopy,
  writeClickSound,
} from '@kitbag/core-native';

export type DatabaseStatus =
  | { readonly ok: true; readonly database: KitbagDatabase }
  | { readonly ok: false; readonly error: DatabaseOpenError };

// One open per launch, failure included: every repository and preference reads
// through here, so an uncached failure would re-run the migration on each access.
let status: DatabaseStatus | undefined;

const migrationCopyFiles: MigrationCopyFiles = {
  freeBytes: () => databaseFreeBytes(DATABASE_NAME),
  remove: (fileName) => {
    removeDatabaseCopy(DATABASE_NAME, fileName);
  },
  replace: (partName, fileName) => {
    replaceDatabaseCopy(DATABASE_NAME, partName, fileName);
  },
};

export const backupRules: BackupRules = {
  latencyOffsetMs: KB_LATENCY_OFFSET_MS_BOUNDS,
  deviceRoutes: KB_FIXED_OUTPUT_ROUTES.filter(
    ({ kind }) => kind !== 'bluetooth',
  ).map(({ id }) => id),
};

function open(): DatabaseStatus {
  try {
    const database = openDatabase(
      {
        read: readClickSound,
        write: writeClickSound,
        remove: deleteClickSound,
      },
      migrationCopyFiles,
      backupRules,
    );
    return { ok: true, database };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DatabaseOpenError
          ? error
          : new DatabaseOpenError('open', { cause: error }),
    };
  }
}

export function databaseStatus(): DatabaseStatus {
  status ??= open();
  return status;
}

export function retryDatabase(): DatabaseStatus {
  if (status?.ok !== true) status = open();
  return status;
}

export function getDatabase(): KitbagDatabase {
  const current = databaseStatus();
  if (!current.ok) throw current.error;
  return current.database;
}
