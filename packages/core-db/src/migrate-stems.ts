export const MIGRATE_V14_TO_V15: readonly string[] = [
  `ALTER TABLE stem_sets ADD COLUMN source TEXT NOT NULL DEFAULT 'folder'
   CHECK (source IN ('folder', 'stemdeck'))`,
  'ALTER TABLE stem_sets ADD COLUMN stemdeck_job_id TEXT',
  'ALTER TABLE stem_sets ADD COLUMN key TEXT',
  'ALTER TABLE stem_sets ADD COLUMN scale TEXT',
  'ALTER TABLE stem_sets ADD COLUMN key_confidence REAL',
  'ALTER TABLE stem_sets ADD COLUMN bpm REAL',
  'ALTER TABLE stem_sets ADD COLUMN loudness_lufs REAL',
  'ALTER TABLE stem_sets ADD COLUMN tempo_stability REAL',
  'ALTER TABLE stem_sets ADD COLUMN beat_grid BLOB',
  'ALTER TABLE stem_sets ADD COLUMN bar_marks BLOB',
  'ALTER TABLE stem_sets ADD COLUMN sections TEXT',
  'ALTER TABLE stem_sets ADD COLUMN lyrics_synced TEXT',
  'ALTER TABLE stem_sets ADD COLUMN lyrics_plain TEXT',
  'ALTER TABLE stem_sets ADD COLUMN lyrics_offset REAL',
  'ALTER TABLE stem_sets ADD COLUMN lyrics_instrumental INTEGER',
  'ALTER TABLE stem_sets ADD COLUMN lyrics_retimed TEXT',
  'ALTER TABLE stem_sets ADD COLUMN speed REAL NOT NULL DEFAULT 1',
  'ALTER TABLE stem_sets ADD COLUMN sample_rate INTEGER',
  'ALTER TABLE stem_sets ADD COLUMN folder TEXT',
  `CREATE UNIQUE INDEX stem_sets_stemdeck_job_id ON stem_sets (stemdeck_job_id)
   WHERE stemdeck_job_id IS NOT NULL`,
  'ALTER TABLE stems ADD COLUMN pitch REAL NOT NULL DEFAULT 0',
  'ALTER TABLE stems ADD COLUMN waveform_path TEXT',
  'ALTER TABLE stems ADD COLUMN frames INTEGER',
];

// The heading a player shows: the song's own title and artist, when the bundle
// carries them apart from its combined title.
export const MIGRATE_V15_TO_V16: readonly string[] = [
  'ALTER TABLE stem_sets ADD COLUMN song_title TEXT',
  'ALTER TABLE stem_sets ADD COLUMN artist TEXT',
];

export const MIGRATE_V16_TO_V17: readonly string[] = [
  'ALTER TABLE stem_sets ADD COLUMN renamed INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE stems ADD COLUMN name TEXT',
];
