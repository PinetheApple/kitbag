import { ENTRY_KIND, type SetlistEntry } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { entry } from './fixtures.test-helper.ts';
import { songListHint, songListRows } from './songList.ts';

describe('song list sheet', () => {
  it('numbers the songs and marks only the loaded one as now', () => {
    const rows = songListRows(
      [entry(1, 'Opener', 132), entry(2, 'Ballad in G', 96.4)],
      2,
    );
    expect(rows.map((r) => [r.number, r.name, r.bpm, r.now])).toEqual([
      ['1', 'Opener', '132', false],
      ['2', 'Ballad in G', '96', true],
    ]);
  });

  it('marks only the loaded item when the song is listed twice', () => {
    const rows = songListRows(
      [entry(1, 'Opener', 132, 7), entry(2, 'Opener', 132, 7)],
      2,
    );
    expect(rows.map((r) => r.now)).toEqual([false, true]);
  });

  it('leaves stem songs out, keeping each song its place in the set', () => {
    const stem = {
      kind: ENTRY_KIND.stem,
      item: { id: 5 },
      stemSetId: 9,
    } as unknown as SetlistEntry;
    const rows = songListRows(
      [stem, entry(1, 'Opener'), entry(2, 'Ballad')],
      1,
    );
    expect(rows.map((r) => [r.number, r.name, r.now])).toEqual([
      ['2', 'Opener', true],
      ['3', 'Ballad', false],
    ]);
  });

  it('marks nothing when the loaded song is not in the set', () => {
    const rows = songListRows([entry(1, 'Opener')], null);
    expect(rows.some((r) => r.now)).toBe(false);
  });

  it('states the position in its hint', () => {
    expect(songListHint({ id: 2, name: 'Gig', count: 4, position: 2 })).toBe(
      'On stage · song 2 of 4 · tap a song to load it',
    );
  });
});
