import { openDatabase, type KitbagDatabase } from '@kitbag/core-db';
import {
  deleteClickSound,
  readClickSound,
  writeClickSound,
} from '@kitbag/core-native';

// The app's one connection: every repository the shell hands to core-state
// comes from this handle (docs/decisions.md, 2026-10-14, item 6).
let database: KitbagDatabase | undefined;

export function getDatabase(): KitbagDatabase {
  database ??= openDatabase({
    read: readClickSound,
    write: writeClickSound,
    remove: deleteClickSound,
  });
  return database;
}
