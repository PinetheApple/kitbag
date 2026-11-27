const MANUAL_TEMPO_COLUMNS = [
  'manual_tempo_bpm REAL',
  'manual_tempo_anchor REAL',
  'manual_tempo_beats_per_bar INTEGER',
];

export const MIGRATE_V31_TO_V32: readonly string[] = [
  'songs',
  'stem_sets',
].flatMap((table) =>
  MANUAL_TEMPO_COLUMNS.map(
    (column) => `ALTER TABLE ${table} ADD COLUMN ${column}`,
  ),
);
