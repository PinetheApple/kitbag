export const MIGRATE_V32_TO_V33: readonly string[] = [
  `CREATE TABLE tool_data (
     tool_id TEXT NOT NULL,
     key TEXT NOT NULL,
     value TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (tool_id, key)
   )`,
];
