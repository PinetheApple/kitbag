// Migration runner for the Kitbag database (SPEC §11.1, §14).
//
// The guarantee (§11.1, §14): migrations are additive and non-destructive. An
// upgrading user's v6 Drift database is picked up IN PLACE — the runner starts
// from whatever `PRAGMA user_version` the Flutter build left (6), not from zero,
// and must not lose their setlists.
//
// The runner is driver-agnostic: it takes a synchronous `MigrationDriver` so
// the same SQL can be exercised headlessly in a test (SPEC §14) and run on
// device through op-sqlite (`executeSync`, see ./client.ts). The transform is
// plain SQLite DDL/DML — no driver-specific behaviour.
//
// This is NOT drizzle-kit generated. drizzle-kit diffs the TS schema against a
// snapshot; it cannot express the v6→v7 DATA transform (rename tables, split
// the setlist→preset link into a join table, drop columns, backfill UUIDs).
// That transform is hand-authored below and tested against a fixture v6 DB.

/** Schema version this build migrates to. Bump and add a step when the schema changes. */
export const SCHEMA_VERSION = 7;

/** The Drift-era schema version an upgrading user arrives with (SPEC §11 intro). */
export const V6_SCHEMA_VERSION = 6;

/**
 * Minimal synchronous SQLite surface the runner needs. Wrap op-sqlite
 * (`executeSync`) on device or `node:sqlite` in tests behind this.
 */
export interface MigrationDriver {
  /** Execute one SQL statement with no returned rows. */
  exec(sql: string): void;
  /** Read `PRAGMA user_version`. */
  getUserVersion(): number;
  /** Write `PRAGMA user_version`. */
  setUserVersion(version: number): void;
}

// UUIDv4-shaped string generated in SQL, used to backfill `uuid` on exportable
// rows during migration (§12.4; D12 accepts a first-merge duplicate). `random()`
// evaluates per row, so each backfilled row gets a distinct value.
const UUID4_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || " +
  "substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || " +
  "'-' || lower(hex(randomblob(6)))";

// The v7 `song_presets` table (SPEC §11.2). Shared verbatim between a fresh
// install and the v6 rebuild so the two paths cannot drift apart. Depends on
// `songs` existing (the `library_song_id` FK), so create `songs` first.
const CREATE_SONG_PRESETS = `CREATE TABLE song_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bpm REAL NOT NULL,
  beats_per_bar INTEGER NOT NULL,
  subdivision INTEGER NOT NULL,
  denominator INTEGER NOT NULL DEFAULT 4,
  accents BLOB NOT NULL,
  per_accent_sounds BLOB,
  poly_enabled INTEGER NOT NULL,
  poly_beats INTEGER NOT NULL,
  sound INTEGER NOT NULL,
  ramp_enabled INTEGER NOT NULL DEFAULT 0,
  ramp_start_bpm REAL,
  ramp_end_bpm REAL,
  ramp_bars INTEGER,
  bar_mute_enabled INTEGER NOT NULL DEFAULT 0,
  bar_mute_play_bars INTEGER,
  bar_mute_mute_bars INTEGER,
  count_in_bars INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  phase_nudge REAL NOT NULL DEFAULT 0,
  title TEXT,
  artist TEXT,
  source TEXT,
  length_seconds REAL,
  library_song_id INTEGER REFERENCES songs (id) ON DELETE SET NULL,
  uuid TEXT NOT NULL
)`;

const CREATE_SETLIST_ITEMS = `CREATE TABLE setlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setlist_id INTEGER NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
  song_preset_id INTEGER NOT NULL REFERENCES song_presets (id) ON DELETE CASCADE,
  position INTEGER NOT NULL
)`;

const CREATE_SUBDIVISION_ACCENTS = `CREATE TABLE subdivision_accents (
  subdivision INTEGER PRIMARY KEY,
  accents BLOB NOT NULL
)`;

const CREATE_BPM_CACHE = `CREATE TABLE bpm_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  bpm REAL NOT NULL,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
)`;

const CREATE_BPM_CACHE_INDEX =
  'CREATE UNIQUE INDEX bpm_cache_title_artist ON bpm_cache (title, artist)';

const CREATE_ROUTE_LATENCY = `CREATE TABLE route_latency (
  route TEXT PRIMARY KEY,
  offset_ms REAL NOT NULL
)`;

// Fresh-install DDL for the v7 schema (SPEC §11.2). Order respects FK targets:
// setlists and songs before song_presets, song_presets before setlist_items.
const CREATE_SETLISTS = `CREATE TABLE setlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  uuid TEXT NOT NULL
)`;

const CREATE_SONGS = `CREATE TABLE songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration REAL NOT NULL,
  format TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  beat_grid BLOB,
  downbeat_indices BLOB,
  bpm REAL,
  waveform_path TEXT,
  uuid TEXT NOT NULL
)`;

const CREATE_TUNINGS = `CREATE TABLE tunings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes BLOB NOT NULL,
  uuid TEXT NOT NULL
)`;

const CREATE_PRACTICE_SESSIONS = `CREATE TABLE practice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  avg_bpm REAL NOT NULL,
  setlist_id INTEGER REFERENCES setlists (id) ON DELETE SET NULL,
  songs_played TEXT
)`;

const CREATE_STEM_SETS = `CREATE TABLE stem_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  uuid TEXT NOT NULL
)`;

const CREATE_STEMS = `CREATE TABLE stems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stem_set_id INTEGER NOT NULL REFERENCES stem_sets (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration REAL NOT NULL,
  format TEXT NOT NULL,
  channel_count INTEGER NOT NULL,
  sample_rate INTEGER NOT NULL,
  gain REAL NOT NULL,
  muted INTEGER NOT NULL,
  soloed INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
)`;

/** Fresh-install baseline: build the whole v7 schema from an empty database. */
export const BASELINE_V7: readonly string[] = [
  CREATE_SETLISTS,
  CREATE_SONGS,
  CREATE_SONG_PRESETS,
  CREATE_SETLIST_ITEMS,
  CREATE_TUNINGS,
  CREATE_PRACTICE_SESSIONS,
  CREATE_STEM_SETS,
  CREATE_STEMS,
  CREATE_SUBDIVISION_ACCENTS,
  CREATE_BPM_CACHE,
  CREATE_BPM_CACHE_INDEX,
  CREATE_ROUTE_LATENCY,
];

/**
 * v6 → v7 transform (SPEC §11.2). Preserves all user data, in order:
 *
 *  1. `songs` (v6 presets) is renamed out of the way so the library table can
 *     take the `songs` name (§11.2 inverts the two).
 *  2. `library_songs` → `songs`; gains `downbeat_indices` (§4.3) and a
 *     backfilled `uuid` (§12.4).
 *  3. The new `song_presets` is built and every v6 preset copied in, KEEPING
 *     its id, dropping `volume`/`latency_offset` (D3), defaulting the new
 *     columns, and backfilling `uuid`.
 *  4. `setlist_items` is built and populated from each v6 preset's
 *     `setlist_id`/`position` — THIS is what preserves setlists: the row is
 *     gone from the preset but its setlist membership survives as a join row
 *     keyed on the preserved preset id. Setlists themselves are only renamed-
 *     untouched (a `uuid` column is added), so no setlist row is ever dropped.
 *  5. The old preset table is dropped once copied.
 *  6. `setlists`, `tunings`, `stem_sets` gain backfilled `uuid`s.
 *  7. The new global/cache tables are created (D2, §8.5, §12.5).
 *
 * `uuid` is added nullable-then-backfilled on the renamed tables (SQLite cannot
 * ADD a NOT NULL column without a constant default); the drizzle schema still
 * declares it NOT NULL and app writes always supply it. The rebuilt
 * `song_presets` is genuinely NOT NULL because it is copied, not altered.
 */
export const MIGRATE_V6_TO_V7: readonly string[] = [
  // 1. move the v6 preset table aside.
  'ALTER TABLE songs RENAME TO song_presets_v6',
  // 2. library_songs becomes songs; add the new columns and backfill uuid.
  'ALTER TABLE library_songs RENAME TO songs',
  'ALTER TABLE songs ADD COLUMN downbeat_indices BLOB',
  'ALTER TABLE songs ADD COLUMN uuid TEXT',
  `UPDATE songs SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  // 3. build song_presets and copy every v6 preset in, keeping its id.
  CREATE_SONG_PRESETS,
  `INSERT INTO song_presets (
     id, name, bpm, beats_per_bar, subdivision, accents,
     poly_enabled, poly_beats, sound, uuid
   )
   SELECT id, name, bpm, beats_per_bar, subdivision, accents,
     poly_enabled, poly_beats, sound, ${UUID4_SQL}
   FROM song_presets_v6`,
  // 4. preserve setlist membership as join rows keyed on the preserved id.
  CREATE_SETLIST_ITEMS,
  `INSERT INTO setlist_items (setlist_id, song_preset_id, position)
   SELECT setlist_id, id, position FROM song_presets_v6`,
  // 5. the v6 preset table is fully migrated.
  'DROP TABLE song_presets_v6',
  // 6. backfill uuid on the remaining exportable tables.
  'ALTER TABLE setlists ADD COLUMN uuid TEXT',
  `UPDATE setlists SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'ALTER TABLE tunings ADD COLUMN uuid TEXT',
  `UPDATE tunings SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'ALTER TABLE stem_sets ADD COLUMN uuid TEXT',
  `UPDATE stem_sets SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  // 7. new global / cache tables.
  CREATE_SUBDIVISION_ACCENTS,
  CREATE_BPM_CACHE,
  CREATE_BPM_CACHE_INDEX,
  CREATE_ROUTE_LATENCY,
];

/** Run a list of statements inside one transaction, rolling back on failure. */
function runStatements(driver: MigrationDriver, statements: readonly string[]): void {
  driver.exec('BEGIN');
  try {
    for (const statement of statements) {
      driver.exec(statement);
    }
    driver.exec('COMMIT');
  } catch (error) {
    driver.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Bring the database up to {@link SCHEMA_VERSION}, preserving existing data.
 *
 * - user_version 0 → fresh install: build the v7 baseline.
 * - user_version in [1, 7) → upgrade: apply the v6→v7 transform in place. (The
 *   Flutter build always migrated users to v6 before this code could run, so an
 *   arriving nonzero version is v6-shaped; SPEC §11.1.)
 * - user_version ≥ 7 → nothing to do.
 *
 * Foreign-key enforcement is disabled around the transform (SQLite cannot
 * toggle it inside a transaction, and table renames confuse in-flight FK
 * checks); it is restored afterwards.
 */
export function migrate(driver: MigrationDriver): void {
  const from = driver.getUserVersion();
  if (from >= SCHEMA_VERSION) {
    return;
  }
  driver.exec('PRAGMA foreign_keys = OFF');
  runStatements(driver, from === 0 ? BASELINE_V7 : MIGRATE_V6_TO_V7);
  driver.setUserVersion(SCHEMA_VERSION);
  driver.exec('PRAGMA foreign_keys = ON');
}
