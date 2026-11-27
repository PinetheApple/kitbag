import { describe, expect, it } from 'vitest';

import { MIGRATE_V24_TO_V25, MIGRATE_V28_TO_V29 } from './migrate-steps';

describe('table rebuild steps', () => {
  it('emits the v25 and v29 rebuilds byte for byte as shipped', () => {
    expect(MIGRATE_V24_TO_V25).toMatchInlineSnapshot(`
      [
        "CREATE TABLE setlist_items_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setlist_id INTEGER NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
        song_preset_id INTEGER REFERENCES song_presets (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        stem_set_id INTEGER REFERENCES stem_sets (id) ON DELETE CASCADE,
        CONSTRAINT setlist_items_one_entry CHECK ((song_preset_id IS NULL) <> (stem_set_id IS NULL))
      )",
        "INSERT INTO setlist_items_next (id, setlist_id, song_preset_id, position)
         SELECT id, setlist_id, song_preset_id, position FROM setlist_items",
        "DELETE FROM sqlite_sequence WHERE name = 'setlist_items_next'",
        "INSERT INTO sqlite_sequence (name, seq)
         SELECT 'setlist_items_next', seq FROM sqlite_sequence WHERE name = 'setlist_items'",
        "DROP TABLE setlist_items",
        "ALTER TABLE setlist_items_next RENAME TO setlist_items",
        "CREATE TABLE play_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stem_set_id INTEGER NOT NULL UNIQUE REFERENCES stem_sets (id) ON DELETE CASCADE,
        position INTEGER NOT NULL
      )",
      ]
    `);
    expect(MIGRATE_V28_TO_V29).toMatchInlineSnapshot(`
      [
        "CREATE TABLE play_queue_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stem_set_id INTEGER UNIQUE REFERENCES stem_sets (id) ON DELETE CASCADE,
        song_id INTEGER UNIQUE REFERENCES songs (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        CONSTRAINT play_queue_one_song CHECK ((stem_set_id IS NULL) <> (song_id IS NULL))
      )",
        "INSERT INTO play_queue_next (id, stem_set_id, position)
         SELECT id, stem_set_id, position FROM play_queue",
        "DELETE FROM sqlite_sequence WHERE name = 'play_queue_next'",
        "INSERT INTO sqlite_sequence (name, seq)
         SELECT 'play_queue_next', seq FROM sqlite_sequence WHERE name = 'play_queue'",
        "DROP TABLE play_queue",
        "ALTER TABLE play_queue_next RENAME TO play_queue",
      ]
    `);
  });
});
