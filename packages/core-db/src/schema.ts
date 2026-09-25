import {
  blob,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const DEFAULT_DENOMINATOR = 4;

export const setlists = sqliteTable('setlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  uuid: text('uuid').notNull(),
  // At most one active row: the setlists_one_active partial index in migrate.ts.
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
});

export const songs = sqliteTable('songs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  // Paths are relative to the user base directory, which the user can move.
  filePath: text('file_path').notNull(),
  duration: real('duration').notNull(),
  format: text('format').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  // Packed float32 beat timestamps in seconds.
  beatGrid: blob('beat_grid', { mode: 'buffer' }),
  // Indices into beatGrid marking downbeats, packed as bytes.
  downbeatIndices: blob('downbeat_indices', { mode: 'buffer' }),
  bpm: real('bpm'),
  waveformPath: text('waveform_path'),
  uuid: text('uuid').notNull(),
});

export const songPresets = sqliteTable('song_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  bpm: real('bpm').notNull(),
  beatsPerBar: integer('beats_per_bar').notNull(),
  subdivision: integer('subdivision').notNull(),
  denominator: integer('denominator').notNull().default(DEFAULT_DENOMINATOR),
  // One kb_accent code byte per beat (polyAccents: per poly slot); one sound
  // code byte per beat in perAccentSounds.
  accents: blob('accents', { mode: 'buffer' }).notNull(),
  perAccentSounds: blob('per_accent_sounds', { mode: 'buffer' }),
  polyAccents: blob('poly_accents', { mode: 'buffer' }),
  polyEnabled: integer('poly_enabled', { mode: 'boolean' }).notNull(),
  polyBeats: integer('poly_beats').notNull(),
  sound: integer('sound').notNull(),
  rampEnabled: integer('ramp_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  rampStartBpm: real('ramp_start_bpm'),
  rampEndBpm: real('ramp_end_bpm'),
  rampBars: integer('ramp_bars'),
  barMuteEnabled: integer('bar_mute_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  barMutePlayBars: integer('bar_mute_play_bars'),
  barMuteMuteBars: integer('bar_mute_mute_bars'),
  countInBars: integer('count_in_bars').notNull().default(0),
  notes: text('notes'),
  phaseNudge: real('phase_nudge').notNull().default(0),
  title: text('title'),
  artist: text('artist'),
  source: text('source'),
  lengthSeconds: real('length_seconds'),
  librarySongId: integer('library_song_id').references(() => songs.id, {
    onDelete: 'set null',
  }),
  uuid: text('uuid').notNull(),
});

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

export const tunings = sqliteTable('tunings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // One MIDI note byte per string, low string first.
  notes: blob('notes', { mode: 'buffer' }).notNull(),
  uuid: text('uuid').notNull(),
});

export const practiceSessions = sqliteTable('practice_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  avgBpm: real('avg_bpm').notNull(),
  setlistId: integer('setlist_id').references(() => setlists.id, {
    onDelete: 'set null',
  }),
  songsPlayed: text('songs_played'),
  uuid: text('uuid').notNull(),
});

export const stemSets = sqliteTable('stem_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  uuid: text('uuid').notNull(),
});

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

export const subdivisionAccents = sqliteTable('subdivision_accents', {
  subdivision: integer('subdivision').primaryKey(),
  // One kb_accent code byte per subdivided pulse.
  accents: blob('accents', { mode: 'buffer' }).notNull(),
});

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
  (table) => [
    uniqueIndex('bpm_cache_title_artist').on(table.title, table.artist),
  ],
);

export const routeLatency = sqliteTable('route_latency', {
  route: text('route').primaryKey(),
  offsetMs: real('offset_ms').notNull(),
});
