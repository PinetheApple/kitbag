import {
  MAX_BEATS,
  MAX_BPM,
  MAX_POLY_BEATS,
  MIN_BPM,
  SOUND_COUNT,
} from './preset-rules';

export const SCHEMA_VERSION = 9;
export const V6_SCHEMA_VERSION = 6;
export const V7_SCHEMA_VERSION = 7;
export const V8_SCHEMA_VERSION = 8;

export interface MigrationDriver {
  exec(sql: string): void;
  getUserVersion(): number;
  setUserVersion(version: number): void;
}

const UUID4_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || " +
  "substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || " +
  "'-' || lower(hex(randomblob(6)))";

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

const CREATE_SETLISTS = `CREATE TABLE setlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  uuid TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
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

const ADD_POLY_ACCENTS =
  'ALTER TABLE song_presets ADD COLUMN poly_accents BLOB';
const CREATE_ONE_ACTIVE_INDEX =
  'CREATE UNIQUE INDEX setlists_one_active ON setlists (active) WHERE active = 1';

const clampColumn = (column: string, low: number, high: number) =>
  `UPDATE song_presets SET ${column} = min(max(${column}, ${String(low)}), ${String(high)})`;

// Flutter read an unknown accent code as normal (legacy converters.dart);
// the repair keeps that meaning and pads or trims to the bar.
const REPAIR_ACCENTS = `UPDATE song_presets SET accents = (
  WITH RECURSIVE beat(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM beat WHERE n < song_presets.beats_per_bar
  )
  SELECT unhex(group_concat(
    CASE WHEN hex(substr(song_presets.accents, n, 1)) IN ('00', '01', '02')
      THEN hex(substr(song_presets.accents, n, 1)) ELSE '01' END,
    '' ORDER BY n))
  FROM beat)`;

const MIGRATE_V8_TO_V9: readonly string[] = [
  clampColumn('bpm', MIN_BPM, MAX_BPM),
  clampColumn('beats_per_bar', 1, MAX_BEATS),
  clampColumn('sound', 0, SOUND_COUNT - 1),
  clampColumn('poly_beats', 0, MAX_POLY_BEATS),
  REPAIR_ACCENTS,
  'UPDATE song_presets SET poly_accents = NULL WHERE length(poly_accents) != poly_beats',
  'UPDATE song_presets SET per_accent_sounds = NULL WHERE length(per_accent_sounds) NOT IN (0, 2)',
  'ALTER TABLE practice_sessions ADD COLUMN uuid TEXT',
  `UPDATE practice_sessions SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'CREATE UNIQUE INDEX practice_sessions_uuid ON practice_sessions (uuid)',
];

export const BASELINE_V9: readonly string[] = [
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
  ADD_POLY_ACCENTS,
  CREATE_ONE_ACTIVE_INDEX,
  ...MIGRATE_V8_TO_V9,
];

// SQLite cannot ADD a NOT NULL column without a constant default, so migrated
// uuid columns stay nullable; every app write supplies one.
export const MIGRATE_V6_TO_V7: readonly string[] = [
  'ALTER TABLE songs RENAME TO song_presets_v6',
  'ALTER TABLE library_songs RENAME TO songs',
  'ALTER TABLE songs ADD COLUMN downbeat_indices BLOB',
  'ALTER TABLE songs ADD COLUMN uuid TEXT',
  `UPDATE songs SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  CREATE_SONG_PRESETS,
  `INSERT INTO song_presets (
     id, name, bpm, beats_per_bar, subdivision, accents,
     poly_enabled, poly_beats, sound, uuid
   )
   SELECT id, name, bpm, beats_per_bar, subdivision, accents,
     poly_enabled, poly_beats, sound, ${UUID4_SQL}
   FROM song_presets_v6`,
  CREATE_SETLIST_ITEMS,
  `INSERT INTO setlist_items (setlist_id, song_preset_id, position)
   SELECT setlist_id, id, position FROM song_presets_v6`,
  'DROP TABLE song_presets_v6',
  'ALTER TABLE setlists ADD COLUMN uuid TEXT',
  `UPDATE setlists SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'ALTER TABLE tunings ADD COLUMN uuid TEXT',
  `UPDATE tunings SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'ALTER TABLE stem_sets ADD COLUMN uuid TEXT',
  `UPDATE stem_sets SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  CREATE_SUBDIVISION_ACCENTS,
  CREATE_BPM_CACHE,
  CREATE_BPM_CACHE_INDEX,
  CREATE_ROUTE_LATENCY,
];

export const MIGRATE_V7_TO_V8: readonly string[] = [
  'ALTER TABLE setlists ADD COLUMN active INTEGER NOT NULL DEFAULT 0',
  CREATE_ONE_ACTIVE_INDEX,
  ADD_POLY_ACCENTS,
];

function runStatements(
  driver: MigrationDriver,
  statements: readonly string[],
): void {
  driver.exec('BEGIN');
  try {
    for (const statement of statements) driver.exec(statement);
    driver.setUserVersion(SCHEMA_VERSION);
    driver.exec('COMMIT');
  } catch (error) {
    driver.exec('ROLLBACK');
    throw error;
  }
}

function upgradeSteps(from: number): readonly string[] {
  if (from === 0) return BASELINE_V9;
  // The Flutter build always migrated users to v6 before this code could run,
  // so any nonzero version below 7 is v6-shaped.
  if (from < V7_SCHEMA_VERSION)
    return [...MIGRATE_V6_TO_V7, ...MIGRATE_V7_TO_V8, ...MIGRATE_V8_TO_V9];
  if (from < V8_SCHEMA_VERSION)
    return [...MIGRATE_V7_TO_V8, ...MIGRATE_V8_TO_V9];
  return MIGRATE_V8_TO_V9;
}

export function migrate(driver: MigrationDriver): void {
  const from = driver.getUserVersion();
  try {
    if (from < SCHEMA_VERSION) {
      // Renames and drops must not fire FK actions, and the pragma is a no-op
      // inside a transaction, so it is toggled around BEGIN.
      driver.exec('PRAGMA foreign_keys = OFF');
      runStatements(driver, upgradeSteps(from));
    }
  } finally {
    driver.exec('PRAGMA foreign_keys = ON');
  }
}
