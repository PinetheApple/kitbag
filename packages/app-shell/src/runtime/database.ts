import {
  DatabaseOpenError,
  openDatabase,
  type KitbagDatabase,
} from '@kitbag/core-db';
import {
  deleteClickSound,
  readClickSound,
  writeClickSound,
} from '@kitbag/core-native';

export type DatabaseStatus =
  | { readonly ok: true; readonly database: KitbagDatabase }
  | { readonly ok: false; readonly error: DatabaseOpenError };

// One open per launch, failure included: every repository and preference reads
// through here, so an uncached failure would re-run the migration on each access.
let status: DatabaseStatus | undefined;

function open(): DatabaseStatus {
  try {
    const database = openDatabase({
      read: readClickSound,
      write: writeClickSound,
      remove: deleteClickSound,
    });
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
