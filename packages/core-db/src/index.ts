export * as schema from './schema';
export {
  migrate,
  SCHEMA_VERSION,
  V6_SCHEMA_VERSION,
  V7_SCHEMA_VERSION,
  BASELINE_V7,
  BASELINE_V8,
  MIGRATE_V6_TO_V7,
  MIGRATE_V7_TO_V8,
  type MigrationDriver,
} from './migrate';
export { openDatabase, opSqliteMigrationDriver, DATABASE_NAME } from './client';
export {
  createSetlistRepository,
  createSongPresetRepository,
  type Database,
  type NewSongPreset,
  type Setlist,
  type SetlistItem,
  type SongPreset,
} from './repositories';
