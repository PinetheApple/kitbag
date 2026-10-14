import { openDatabase, type KitbagDatabase } from '@kitbag/core-db';

// The app's one database connection (docs/decisions.md, 2026-10-14, item 6).
// Every repository the shell hands to core-state comes from this handle; #109's
// composition root absorbs this module when it lands.
let database: KitbagDatabase | undefined;

export function getDatabase(): KitbagDatabase {
  database ??= openDatabase();
  return database;
}
