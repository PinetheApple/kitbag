// core-db — Drizzle schema, migrations and the op-sqlite client (SPEC §13.1,
// §11.1). May import core-plugin-api only.
//
// The realtime layer never queries this during playback: the beat grid is
// handed to `kb_metronome_set_grid` and waveform peaks to the renderer, once,
// off the UI thread (SPEC §11.2). Nothing here is on a 60fps path.

export * as schema from './schema';
export {
  migrate,
  SCHEMA_VERSION,
  V6_SCHEMA_VERSION,
  BASELINE_V7,
  MIGRATE_V6_TO_V7,
  type MigrationDriver,
} from './migrate';
export { openDatabase, opSqliteMigrationDriver, DATABASE_NAME } from './client';
