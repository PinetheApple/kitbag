import { openDatabase, type KitbagDatabase } from '@kitbag/core-db';

// The app's one database connection (docs/decisions.md, 2026-10-14, item 6).
// Every repository the shell hands to core-state comes from this handle; #109's
// composition root absorbs this module when it lands. Opened on first use, not
// at import, so a launch that never touches stored data never runs migrations.
let database: KitbagDatabase | undefined;

export function getDatabase(): KitbagDatabase {
  database ??= openDatabase();
  return database;
}
