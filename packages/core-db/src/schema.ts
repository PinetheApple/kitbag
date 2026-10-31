import { sql } from 'drizzle-orm';
import {
  customType,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { ANALYSIS_STATUS, ANALYSIS_STATUSES } from './analysis-status';
import { DEFAULT_DENOMINATOR, RAMP_UNITS } from './preset-rules';
import { STEM_SET_SOURCE, STEM_SET_SOURCES } from './stem-set-source';
import { INSTRUMENTS } from './tuning-rules';

function toBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value))
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
  throw new TypeError(`Expected blob bytes, got ${typeof value}`);
}

const bytes = customType<{ data: Uint8Array; driverData: unknown }>({
  dataType: () => 'blob',
  fromDriver: toBytes,
  toDriver: (value) => value,
});

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
  beatGrid: bytes('beat_grid'),
  // Indices into beatGrid marking downbeats, packed little-endian int32.
  downbeatIndices: bytes('downbeat_indices'),
  bpm: real('bpm'),
  waveformPath: text('waveform_path'),
  uuid: text('uuid').notNull(),
  // A finished analysis can find no beats, so a missing grid does not mean
  // "not analyzed yet".
  analysisStatus: text('analysis_status', {
    enum: ANALYSIS_STATUSES,
  })
    .notNull()
    .default(ANALYSIS_STATUS.pending),
  analysisError: text('analysis_error'),
});

export const songPresets = sqliteTable('song_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  bpm: real('bpm').notNull(),
  beatsPerBar: integer('beats_per_bar').notNull(),
  subdivision: integer('subdivision').notNull(),
  denominator: integer('denominator').notNull().default(DEFAULT_DENOMINATOR),
  // One kb_accent code byte per beat (polyAccents: per poly slot).
  accents: bytes('accents').notNull(),
  perAccentSounds: bytes('per_accent_sounds'),
  polyAccents: bytes('poly_accents'),
  polyEnabled: integer('poly_enabled', { mode: 'boolean' }).notNull(),
  polyBeats: integer('poly_beats').notNull(),
  sound: integer('sound').notNull(),
  rampEnabled: integer('ramp_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  rampStartBpm: real('ramp_start_bpm'),
  rampEndBpm: real('ramp_end_bpm'),
  rampLength: real('ramp_length'),
  rampStep: real('ramp_step').notNull().default(1),
  rampUnit: integer('ramp_unit').notNull().default(RAMP_UNITS.bars),
  rampLoop: integer('ramp_loop', { mode: 'boolean' }).notNull().default(false),
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
  notes: bytes('notes').notNull(),
  uuid: text('uuid').notNull(),
  // A KB_TUNER_INSTRUMENT_* value.
  instrument: integer('instrument').notNull().default(INSTRUMENTS.guitar),
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

export const stemSets = sqliteTable(
  'stem_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    songTitle: text('song_title'),
    artist: text('artist'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    uuid: text('uuid').notNull(),
    source: text('source', { enum: STEM_SET_SOURCES })
      .notNull()
      .default(STEM_SET_SOURCE.folder),
    stemdeckJobId: text('stemdeck_job_id'),
    key: text('key'),
    scale: text('scale'),
    keyConfidence: real('key_confidence'),
    bpm: real('bpm'),
    loudnessLufs: real('loudness_lufs'),
    tempoStability: real('tempo_stability'),
    beatGrid: bytes('beat_grid'),
    // Little-endian int32 pairs: beat index into beatGrid, beats per bar.
    barMarks: bytes('bar_marks'),
    sections: text('sections'),
    lyricsSynced: text('lyrics_synced'),
    lyricsPlain: text('lyrics_plain'),
    lyricsOffset: real('lyrics_offset'),
    // Null when the bundle had no lyrics at all, not just none to show.
    lyricsInstrumental: integer('lyrics_instrumental', { mode: 'boolean' }),
    lyricsRetimed: text('lyrics_retimed'),
    speed: real('speed').notNull().default(1),
    sampleRate: integer('sample_rate'),
    folder: text('folder'),
    renamed: integer('renamed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    uniqueIndex('stem_sets_stemdeck_job_id')
      .on(table.stemdeckJobId)
      .where(sql`stemdeck_job_id IS NOT NULL`),
  ],
);

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
  pitch: real('pitch').notNull().default(0),
  waveformPath: text('waveform_path'),
  frames: integer('frames'),
  name: text('name'),
});

export const subdivisionAccents = sqliteTable('subdivision_accents', {
  subdivision: integer('subdivision').primaryKey(),
  // One kb_accent code byte per subdivided pulse.
  accents: bytes('accents').notNull(),
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
  name: text('name'),
  kind: text('kind'),
});

export const preferences = sqliteTable('preferences', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
