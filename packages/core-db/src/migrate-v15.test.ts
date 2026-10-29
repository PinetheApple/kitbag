import { describe, expect, it } from 'vitest';

import { migrate, MIGRATE_V14_TO_V15, SCHEMA_VERSION } from './migrate';
import { buildV14Fixture, pragma, rows } from './migrate-fixtures.test-helper';
import { nodeSqliteDriver } from './sqlite.test-helper';
import { STEM_SET_SOURCES } from './stem-set-source';

const NEW_SET_COLUMNS = {
  source: 'folder',
  stemdeck_job_id: null,
  key: null,
  scale: null,
  key_confidence: null,
  bpm: null,
  loudness_lufs: null,
  tempo_stability: null,
  beat_grid: null,
  bar_marks: null,
  sections: null,
  lyrics_synced: null,
  lyrics_plain: null,
  lyrics_offset: null,
  lyrics_instrumental: null,
  lyrics_retimed: null,
  speed: 1,
  sample_rate: null,
  folder: null,
  song_title: null,
  artist: null,
  renamed: 0,
};

function withFolderSet() {
  const db = buildV14Fixture();
  db.exec(`INSERT INTO stem_sets (id, name, created_at, uuid)
    VALUES (1, 'Redbone', 1700000000, 's')`);
  db.exec(`INSERT INTO stems (stem_set_id, role, file_path, duration, format, channel_count, sample_rate, gain, muted, soloed, sort_order)
    VALUES (1, 'drums', 'stems/Redbone/drums.flac', 326.5, 'flac', 2, 48000, 0.8, 1, 0, 0)`);
  return db;
}

describe('migrate v14 to v15', () => {
  it('keeps every stem set and stem, reading old sets as folder imports', () => {
    const db = withFolderSet();
    const sets = () => rows(db, 'SELECT * FROM stem_sets ORDER BY id');
    const stems = () => rows(db, 'SELECT * FROM stems ORDER BY id');
    const before = { sets: sets(), stems: stems() };
    migrate(nodeSqliteDriver(db));
    expect(sets()).toEqual(
      before.sets.map((row) => ({ ...(row as object), ...NEW_SET_COLUMNS })),
    );
    expect(stems()).toEqual(
      before.stems.map((row) => ({
        ...(row as object),
        pitch: 0,
        waveform_path: null,
        frames: null,
        name: null,
      })),
    );
    expect(pragma(db, 'user_version')).toBe(SCHEMA_VERSION);
  });

  it('allows one stem set per StemDeck job and any number of folder sets', () => {
    const db = withFolderSet();
    migrate(nodeSqliteDriver(db));
    const insert = (uuid: string, jobId: string | null) =>
      db
        .prepare(
          "INSERT INTO stem_sets (name, created_at, uuid, source, stemdeck_job_id) VALUES ('x', 1, ?, 'stemdeck', ?)",
        )
        .run(uuid, jobId);
    insert('a', '0297074f4836');
    insert('b', null);
    insert('c', null);
    expect(() => insert('d', '0297074f4836')).toThrow();
    expect(() => {
      db.exec("UPDATE stem_sets SET source = 'moises' WHERE id = 1");
    }).toThrow();
  });

  it('accepts exactly the sources the app writes', () => {
    const [addSource] = MIGRATE_V14_TO_V15;
    const allowed = /IN \(([^)]*)\)/.exec(addSource ?? '')?.[1];
    expect(allowed?.split(', ').map((v) => v.replace(/'/g, ''))).toEqual(
      STEM_SET_SOURCES,
    );
    expect(addSource).toContain(`DEFAULT '${STEM_SET_SOURCES[0]}'`);
  });
});
