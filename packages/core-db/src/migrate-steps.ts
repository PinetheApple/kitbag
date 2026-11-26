import { CLICK_RATE } from './click-rate';
import { REPAIR_PRESETS } from './preset-repair';
import { POLY_AGAINST_BAR, RAMP_UNITS } from './preset-rules';
import { INSTRUMENTS, MAX_MIDI_NOTE, MAX_STRINGS } from './tuning-rules';
import {
  MIGRATE_V14_TO_V15,
  MIGRATE_V15_TO_V16,
  MIGRATE_V16_TO_V17,
} from './migrate-stems';
import { MIGRATE_V30_TO_V31 } from './migrate-presets';
import { rebuildTable } from './migrate-rebuild';

const UUID4_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || " +
  "substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || " +
  "'-' || lower(hex(randomblob(6)))";

const CREATE_SONG_PRESETS_V7 = `CREATE TABLE song_presets (
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

export const MIGRATE_V8_TO_V9: readonly string[] = [
  ...REPAIR_PRESETS,
  'ALTER TABLE practice_sessions ADD COLUMN uuid TEXT',
  `UPDATE practice_sessions SET uuid = ${UUID4_SQL} WHERE uuid IS NULL`,
  'CREATE UNIQUE INDEX practice_sessions_uuid ON practice_sessions (uuid)',
  ...['INSERT', 'UPDATE'].map(
    (event) => `CREATE TRIGGER practice_sessions_uuid_${event.toLowerCase()}
      BEFORE ${event} ON practice_sessions WHEN NEW.uuid IS NULL
      BEGIN SELECT RAISE(ABORT, 'practice_sessions.uuid is required'); END`,
  ),
];

const HEX_RADIX = 16;
const MAX_NOTE_HEX = MAX_MIDI_NOTE.toString(HEX_RADIX)
  .toUpperCase()
  .padStart(2, '0');

// Legacy rows the tuner can never load (no strings, too many, a note byte above
// MIDI range) are dropped, so every stored tuning passes backup import.
const DELETE_UNLOADABLE_TUNINGS = `DELETE FROM tunings
  WHERE length(notes) NOT BETWEEN 1 AND ${String(MAX_STRINGS)}
  OR id IN (
    WITH RECURSIVE note (id, notes, at) AS (
      SELECT id, notes, 1 FROM tunings
      UNION ALL SELECT id, notes, at + 1 FROM note WHERE at < length(notes)
    )
    SELECT id FROM note WHERE hex(substr(notes, at, 1)) > '${MAX_NOTE_HEX}'
  )`;

export const MIGRATE_V9_TO_V10: readonly string[] = [
  `ALTER TABLE tunings ADD COLUMN instrument INTEGER NOT NULL DEFAULT ${String(INSTRUMENTS.guitar)}`,
  DELETE_UNLOADABLE_TUNINGS,
];

export const MIGRATE_V10_TO_V11: readonly string[] = [
  `CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`,
];

const CREATE_SONG_PRESETS_V12 = `CREATE TABLE song_presets_v12 (
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
  ramp_length REAL,
  ramp_unit INTEGER NOT NULL DEFAULT ${String(RAMP_UNITS.bars)},
  ramp_loop INTEGER NOT NULL DEFAULT 0,
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
  uuid TEXT NOT NULL,
  poly_accents BLOB
)`;

// INTEGER ramp_bars becomes REAL ramp_length, a type change SQLite can only make by rebuilding.
export const MIGRATE_V11_TO_V12: readonly string[] = [
  CREATE_SONG_PRESETS_V12,
  `INSERT INTO song_presets_v12 (id, name, bpm, beats_per_bar, subdivision, denominator, accents, per_accent_sounds, poly_enabled, poly_beats, sound, ramp_enabled, ramp_start_bpm, ramp_end_bpm, ramp_length, bar_mute_enabled, bar_mute_play_bars, bar_mute_mute_bars, count_in_bars, notes, phase_nudge, title, artist, source, length_seconds, library_song_id, uuid, poly_accents)
   SELECT id, name, bpm, beats_per_bar, subdivision, denominator, accents, per_accent_sounds, poly_enabled, poly_beats, sound, ramp_enabled, ramp_start_bpm, ramp_end_bpm, ramp_bars, bar_mute_enabled, bar_mute_play_bars, bar_mute_mute_bars, count_in_bars, notes, phase_nudge, title, artist, source, length_seconds, library_song_id, uuid, poly_accents FROM song_presets`,
  `UPDATE sqlite_sequence SET seq =
   (SELECT seq FROM sqlite_sequence WHERE name = 'song_presets')
   WHERE name = 'song_presets_v12'`,
  'DROP TABLE song_presets',
  'ALTER TABLE song_presets_v12 RENAME TO song_presets',
];

export const V11_BASELINE: readonly string[] = [
  CREATE_SETLISTS,
  CREATE_SONGS,
  CREATE_SONG_PRESETS_V7,
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
  ...MIGRATE_V9_TO_V10,
  ...MIGRATE_V10_TO_V11,
];

// A ramp moves by a step every interval (SPEC §5.3, D15); ramp_length is now
// that interval.
export const MIGRATE_V12_TO_V13: readonly string[] = [
  'ALTER TABLE song_presets ADD COLUMN ramp_step REAL NOT NULL DEFAULT 1',
];

export const MIGRATE_V13_TO_V14: readonly string[] = [
  `ALTER TABLE songs ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'pending'
   CHECK (analysis_status IN ('pending', 'analyzing', 'done', 'failed'))`,
  "UPDATE songs SET analysis_status = 'done' WHERE beat_grid IS NOT NULL",
  'ALTER TABLE songs ADD COLUMN analysis_error TEXT',
];

export const MIGRATE_V17_TO_V18: readonly string[] = [
  `ALTER TABLE song_presets ADD COLUMN poly_against INTEGER NOT NULL DEFAULT ${String(POLY_AGAINST_BAR)}`,
];

export const MIGRATE_V18_TO_V19: readonly string[] = [
  'ALTER TABLE route_latency ADD COLUMN name TEXT',
  'ALTER TABLE route_latency ADD COLUMN kind TEXT',
];

// No CHECK on the meter: the supported set lives in meter-override.ts and may grow.
export const MIGRATE_V19_TO_V20: readonly string[] = [
  ...['songs', 'stem_sets'].flatMap((table) => [
    `ALTER TABLE ${table} ADD COLUMN meter_beats_per_bar INTEGER`,
    `ALTER TABLE ${table} ADD COLUMN bar_one_seconds REAL`,
  ]),
  'ALTER TABLE songs ADD COLUMN analysis_version INTEGER',
];

export const MIGRATE_V20_TO_V21: readonly string[] = [
  'ALTER TABLE stem_sets ADD COLUMN click_grouping TEXT',
  `ALTER TABLE stem_sets ADD COLUMN click_rate TEXT NOT NULL DEFAULT '${CLICK_RATE.single}'`,
];

// No CHECKs on the tempo words: tempo-mode.ts owns the valid set.
export const MIGRATE_V21_TO_V22: readonly string[] = [
  'ALTER TABLE stem_sets ADD COLUMN tempo_mode TEXT',
  'ALTER TABLE stem_sets ADD COLUMN tempo_bpm REAL',
  'ALTER TABLE stem_sets ADD COLUMN tempo_anchor REAL',
  'ALTER TABLE stem_sets ADD COLUMN tempo_beats_per_bar INTEGER',
  'ALTER TABLE stem_sets ADD COLUMN tempo_source TEXT',
  'ALTER TABLE stem_sets ADD COLUMN chosen_tempo_mode TEXT',
];

// No CHECK on the slot: the engine owns the slot count and may grow it.
export const MIGRATE_V22_TO_V23: readonly string[] = [
  `CREATE TABLE click_sounds (
  slot INTEGER PRIMARY KEY,
  uuid TEXT NOT NULL,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL
)`,
];

// No CHECK on the factor: tempo-correction.ts owns the valid set.
export const MIGRATE_V23_TO_V24: readonly string[] = [
  'ALTER TABLE songs ADD COLUMN tempo_correction TEXT',
];

// song_preset_id loses NOT NULL and gains a CHECK, which SQLite can only do by rebuilding.
export const MIGRATE_V24_TO_V25: readonly string[] = [
  ...rebuildTable(
    'setlist_items',
    `CREATE TABLE setlist_items_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setlist_id INTEGER NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
  song_preset_id INTEGER REFERENCES song_presets (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  stem_set_id INTEGER REFERENCES stem_sets (id) ON DELETE CASCADE,
  CONSTRAINT setlist_items_one_entry CHECK ((song_preset_id IS NULL) <> (stem_set_id IS NULL))
)`,
    ['id', 'setlist_id', 'song_preset_id', 'position'],
  ),
  `CREATE TABLE play_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stem_set_id INTEGER NOT NULL UNIQUE REFERENCES stem_sets (id) ON DELETE CASCADE,
  position INTEGER NOT NULL
)`,
];

export const MIGRATE_V25_TO_V26: readonly string[] = [
  'ALTER TABLE practice_sessions ADD COLUMN log TEXT',
  'ALTER TABLE practice_sessions ADD COLUMN setlist_name TEXT',
  `UPDATE practice_sessions SET setlist_name =
   (SELECT name FROM setlists WHERE setlists.id = practice_sessions.setlist_id)
   WHERE setlist_id IS NOT NULL`,
  'CREATE INDEX practice_sessions_start_time ON practice_sessions (start_time)',
];

// Frozen at the engine's key range when written; a later range change needs its own migration.
export const MIGRATE_V26_TO_V27: readonly string[] = [
  'ALTER TABLE stem_sets ADD COLUMN pitch INTEGER NOT NULL DEFAULT 0 CHECK (pitch BETWEEN -6 AND 6)',
];

export const MIGRATE_V27_TO_V28: readonly string[] = [
  'ALTER TABLE songs ADD COLUMN speed REAL NOT NULL DEFAULT 1',
];

export const MIGRATE_V28_TO_V29: readonly string[] = rebuildTable(
  'play_queue',
  `CREATE TABLE play_queue_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stem_set_id INTEGER UNIQUE REFERENCES stem_sets (id) ON DELETE CASCADE,
  song_id INTEGER UNIQUE REFERENCES songs (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  CONSTRAINT play_queue_one_song CHECK ((stem_set_id IS NULL) <> (song_id IS NULL))
)`,
  ['id', 'stem_set_id', 'position'],
);

export const MIGRATE_V29_TO_V30: readonly string[] = [
  'ALTER TABLE songs ADD COLUMN tempo_mode TEXT',
  'ALTER TABLE songs ADD COLUMN tempo_bpm REAL',
  'ALTER TABLE songs ADD COLUMN tempo_anchor REAL',
  'ALTER TABLE songs ADD COLUMN tempo_beats_per_bar INTEGER',
  'ALTER TABLE songs ADD COLUMN tempo_source TEXT',
  'ALTER TABLE songs ADD COLUMN chosen_tempo_mode TEXT',
];

export const BASELINE: readonly string[] = [
  ...V11_BASELINE,
  ...MIGRATE_V11_TO_V12,
  ...MIGRATE_V12_TO_V13,
  ...MIGRATE_V13_TO_V14,
  ...MIGRATE_V14_TO_V15,
  ...MIGRATE_V15_TO_V16,
  ...MIGRATE_V16_TO_V17,
  ...MIGRATE_V17_TO_V18,
  ...MIGRATE_V18_TO_V19,
  ...MIGRATE_V19_TO_V20,
  ...MIGRATE_V20_TO_V21,
  ...MIGRATE_V21_TO_V22,
  ...MIGRATE_V22_TO_V23,
  ...MIGRATE_V23_TO_V24,
  ...MIGRATE_V24_TO_V25,
  ...MIGRATE_V25_TO_V26,
  ...MIGRATE_V26_TO_V27,
  ...MIGRATE_V27_TO_V28,
  ...MIGRATE_V28_TO_V29,
  ...MIGRATE_V29_TO_V30,
  ...MIGRATE_V30_TO_V31,
];

export const MIGRATE_V7_TO_V8: readonly string[] = [
  'ALTER TABLE setlists ADD COLUMN active INTEGER NOT NULL DEFAULT 0',
  CREATE_ONE_ACTIVE_INDEX,
  ADD_POLY_ACCENTS,
];
