import type { LibraryStemSetRow } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  stemSongFacts,
  stemSongListFacts,
  stemSongsById,
} from './stemSongText.ts';

const row = (fields: Partial<LibraryStemSetRow> = {}): LibraryStemSetRow => ({
  kind: 'stems',
  id: 3,
  title: 'Glass Orchard',
  artist: 'Morrow Lane',
  stemCount: 6,
  durationSec: 268.4,
  bpm: 127.2,
  key: 'D',
  scale: 'minor',
  hasGrid: true,
  createdAt: new Date(0),
  ...fields,
});

describe('stem song text', () => {
  it('reads length, key and tempo for a setlist row', () => {
    expect(stemSongFacts(row())).toBe('4:28 · D min · 127 BPM');
  });

  it('reads artist, length and key for a pick row', () => {
    expect(stemSongListFacts(row())).toBe('Morrow Lane · 4:28 · D min');
  });

  it('reads the length in whole seconds played, as the player clock does', () => {
    expect(stemSongFacts(row({ durationSec: 149.6 }))).toBe(
      '2:29 · D min · 127 BPM',
    );
    expect(stemSongListFacts(row({ durationSec: 149.6 }))).toBe(
      'Morrow Lane · 2:29 · D min',
    );
  });

  it('leaves out what the song does not have', () => {
    const bare = row({ artist: null, durationSec: 0, bpm: null, key: null });
    expect(stemSongFacts(bare)).toBe('');
    expect(stemSongListFacts(bare)).toBe('');
  });

  it('indexes only the stem songs of a library', () => {
    const song = { kind: 'song', id: 3 };
    expect([...stemSongsById([song, row()]).keys()]).toEqual([3]);
    expect(stemSongsById([song]).size).toBe(0);
  });
});
