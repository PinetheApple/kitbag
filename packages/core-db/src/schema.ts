// Drizzle schema for the Kitbag data model (SPEC §11). This is the v7 shape:
// the v6 Drift schema (SPEC §11 intro) migrated per §11.2, with the D1/D3/D4
// rulings (§11.3) applied.
//
// Column DB names are snake_case to match what Drift emitted on disk, so an
// upgrading user's v6 database (SPEC §11.1, §14) keeps its columns in place
// through `migrate()` (see ./migrate.ts) instead of being rebuilt from zero.

import {
  blob,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// D1 (SPEC §11.2, §11.3): time-signature denominator is a new column; 2/4/8/16.
// New rows default to 4/4 until a preset sets otherwise.
const DEFAULT_DENOMINATOR = 4;

/// A named, ordered collection of song presets (SPEC §5.4). `uuid` is the
/// stable export/merge identity (§12.4), backfilled on migration.
export const setlists = sqliteTable('setlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  uuid: text('uuid').notNull(),
});

/// An imported audio song in the user's library. This is what v6 called
/// `LibrarySongs`; §11.2 inverts the names so the library table is `Songs`.
/// `filePath`/`waveformPath` are relative to the user base directory (§11.2,
/// D11). `downbeatIndices` is the §4.3 addition and lives here in TS
/// persistence, not native.
export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  filePath: text('file_path').notNull(),
  duration: real('duration').notNull(),
  format: text('format').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  /// Beat timestamps as a packed float32 array, one per beat (seconds).
  beatGrid: blob('beat_grid', { mode: 'buffer' }),
  /// Indices into `beatGrid` marking downbeats (§4.3), packed as bytes.
  downbeatIndices: blob('downbeat_indices', { mode: 'buffer' }),
  bpm: real('bpm'),
  waveformPath: text('waveform_path'),
  uuid: text('uuid').notNull(),
});

/// A metronome preset: everything the sequencer needs to recall a song on
/// stage. This is what v6 called `Songs`; §11.2 renames it `SongPresets` and
/// decouples it from setlists (a preset exists standalone; setlists reference
/// it through `setlistItems`). `accents` stores one `kb_accent` code byte per
/// beat; `perAccentSounds` (§5.3) optionally stores one sound code per beat.
/// D3 (§11.2): the v6 `volume`/`latencyOffset` columns are dropped — both are
/// global rig setup, not per-song. D4 (§8.8): the `(title, artist, source,
/// lengthSeconds)` identity tuple plus a nullable `librarySongId` FK.
export const songPresets = sqliteTable('song_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  bpm: real('bpm').notNull(),
  beatsPerBar: integer('beats_per_bar').notNull(),
  subdivision: integer('subdivision').notNull(),
  denominator: integer('denominator').notNull().default(DEFAULT_DENOMINATOR),
  accents: blob('accents', { mode: 'buffer' }).notNull(),
  perAccentSounds: blob('per_accent_sounds', { mode: 'buffer' }),
  polyEnabled: integer('poly_enabled', { mode: 'boolean' }).notNull(),
  polyBeats: integer('poly_beats').notNull(),
  sound: integer('sound').notNull(),
  // Tempo ramp config (§5.3).
  rampEnabled: integer('ramp_enabled', { mode: 'boolean' }).notNull().default(false),
  rampStartBpm: real('ramp_start_bpm'),
  rampEndBpm: real('ramp_end_bpm'),
  rampBars: integer('ramp_bars'),
  // Bar-mute config (§5.3): play N bars, mute M bars.
  barMuteEnabled: integer('bar_mute_enabled', { mode: 'boolean' }).notNull().default(false),
  barMutePlayBars: integer('bar_mute_play_bars'),
  barMuteMuteBars: integer('bar_mute_mute_bars'),
  // Count-in bars before the preset starts (§5.3).
  countInBars: integer('count_in_bars').notNull().default(0),
  notes: text('notes'),
  // Per-song phase nudge (§8.8).
  phaseNudge: real('phase_nudge').notNull().default(0),
  // D4 identity tuple (§8.8) — matched against the library until a track joins it.
  title: text('title'),
  artist: text('artist'),
  source: text('source'),
  lengthSeconds: real('length_seconds'),
  librarySongId: integer('library_song_id').references(() => songs.id, {
    onDelete: 'set null',
  }),
  uuid: text('uuid').notNull(),
});

/// Join row placing a `songPreset` in a `setlist` at `position` (§5.4). Only
/// relative order matters, so gaps from deletions are fine. This is the
/// decoupling §11.2 requires: setlists reference presets rather than owning them.
export const setlistItems = sqliteTable('setlist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  setlistId: integer('setlist_id')
    .notNull()
    .references(() => setlists.id, { onDelete: 'cascade' }),
  songPresetId: integer('song_preset_id')
    .notNull()
    .references(() => songPresets.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
});

/// A saved custom instrument tuning: one MIDI note byte per string in `notes`,
/// low string first. Built-in presets live in code; only user tunings persist.
export const tunings = sqliteTable('tunings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  notes: blob('notes', { mode: 'buffer' }).notNull(),
  uuid: text('uuid').notNull(),
});

/// A logged practice session: when it happened, how long, and optional context
/// (which setlist and songs were used, §5.7).
export const practiceSessions = sqliteTable('practice_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  avgBpm: real('avg_bpm').notNull(),
  setlistId: integer('setlist_id').references(() => setlists.id, {
    onDelete: 'set null',
  }),
  songsPlayed: text('songs_played'),
});

/// A named group of stem tracks, imported from a single folder.
export const stemSets = sqliteTable('stem_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  uuid: text('uuid').notNull(),
});

/// An individual stem track within a stem set. `role` identifies the instrument.
export const stems = sqliteTable('stems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stemSetId: integer('stem_set_id')
    .notNull()
    .references(() => stemSets.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  filePath: text('file_path').notNull(),
  duration: real('duration').notNull(),
  format: text('format').notNull(),
  channelCount: integer('channel_count').notNull(),
  sampleRate: integer('sample_rate').notNull(),
  gain: real('gain').notNull(),
  muted: integer('muted', { mode: 'boolean' }).notNull(),
  soloed: integer('soloed', { mode: 'boolean' }).notNull(),
  sortOrder: integer('sort_order').notNull(),
});

/// Global subdivision-accent patterns, keyed by subdivision count (D2, §11.2).
/// One pattern per subdivision count, shared across all presets — no per-song
/// table. `accents` is one `kb_accent` code byte per subdivided pulse.
export const subdivisionAccents = sqliteTable('subdivision_accents', {
  subdivision: integer('subdivision').primaryKey(),
  accents: blob('accents', { mode: 'buffer' }).notNull(),
});

/// BPM lookup cache (§8.5): keyed by (title, artist) with a TTL read off
/// `fetchedAt`. `source` names the ladder rung the value came from.
export const bpmCache = sqliteTable(
  'bpm_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    bpm: real('bpm').notNull(),
    source: text('source').notNull(),
    fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [uniqueIndex('bpm_cache_title_artist').on(table.title, table.artist)],
);

/// Per-output-route latency calibration (§12.5). The offset is a phase bias in
/// milliseconds, stored against the route rather than globally (D5: ±300 ms).
export const routeLatency = sqliteTable('route_latency', {
  route: text('route').primaryKey(),
  offsetMs: real('offset_ms').notNull(),
});
