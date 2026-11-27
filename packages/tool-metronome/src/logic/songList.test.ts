import { ENTRY_KIND, type SetlistEntry } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { entry } from './fixtures.test-helper.ts';
import { UNKNOWN_STEM_SONG } from '@kitbag/core-state';
import { songListHint, songListRows } from './songList.ts';

const NO_STEMS = new Map();

describe('song list sheet', () => {
  it('numbers the songs and marks only the loaded one as now', () => {
    const rows = songListRows(
      [entry(1, 'Opener', 132), entry(2, 'Ballad in G', 96.4)],
      2,
      NO_STEMS,
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
      NO_STEMS,
    );
    expect(rows.map((r) => r.now)).toEqual([false, true]);
  });

  it('lists stem songs in their place, by title and with no tempo', () => {
    const stem = (itemId: number, stemSetId: number) =>
      ({
        kind: ENTRY_KIND.stem,
        item: { id: itemId },
        stemSetId,
      }) as unknown as SetlistEntry;
    const stems = new Map([
      [9, { title: 'Night Bus' }],
    ]) as unknown as Parameters<typeof songListRows>[2];
    const rows = songListRows(
      [stem(5, 9), entry(1, 'Opener'), stem(6, 4)],
      5,
      stems,
    );
    expect(
      rows.map((r) => [r.number, r.name, r.bpm, r.stemSetId, r.now]),
    ).toEqual([
      ['1', 'Night Bus', null, 9, true],
      ['2', 'Opener', '120', null, false],
      ['3', UNKNOWN_STEM_SONG, null, 4, false],
    ]);
  });

  it('shows no tempo for a song that saves none', () => {
    const [row] = songListRows([entry(1, 'Click only', null)], null, NO_STEMS);
    expect(row?.bpm).toBeNull();
  });

  it('marks nothing when the loaded song is not in the set', () => {
    const rows = songListRows([entry(1, 'Opener')], null, NO_STEMS);
    expect(rows.some((r) => r.now)).toBe(false);
  });

  it('states the position in its hint', () => {
    expect(songListHint({ id: 2, name: 'Gig', count: 4, position: 2 })).toBe(
      'On stage · song 2 of 4 · tap a song to load it',
    );
  });
});
