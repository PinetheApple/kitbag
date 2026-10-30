import { describe, expect, it } from 'vitest';

import {
  SONG_STEP,
  type SetlistEntry,
  type SetlistSummary,
} from '@kitbag/core-state';

import {
  activeSetOf,
  NO_ACTIVE_SET,
  NOT_IN_SETLIST,
  setlistChipA11yLabel,
  setlistChipLabel,
  songChipA11yLabel,
  soloChipText,
  stageChipText,
  songListHint,
  songListRows,
  stepA11yLabel,
} from './setlistChip.ts';

describe('setlist chip', () => {
  it('shows the active set and the loaded song position', () => {
    const set = { id: 1, name: 'Wedding set', count: 12, position: 3 };
    expect(setlistChipLabel(set)).toBe('Wedding set · 3/12');
    expect(setlistChipA11yLabel(set)).toBe('Setlist Wedding set, song 3 of 12');
  });

  it('shows the song count when no song from the set is loaded', () => {
    const set = { id: 1, name: 'Gig', count: 1, position: undefined };
    expect(setlistChipLabel(set)).toBe('Gig · 1 song');
  });

  it('claims no set when none is active', () => {
    expect(setlistChipLabel(undefined)).toBe(NO_ACTIVE_SET);
    expect(setlistChipA11yLabel(undefined)).toBe('Setlists, none active');
  });
});

const summary = (
  id: number,
  name: string,
  active: boolean,
  songCount: number,
) =>
  ({
    setlist: { id, name, active },
    songCount,
    rampCount: 0,
  }) as unknown as SetlistSummary;
const entry = (itemId: number, name = '', bpm = 120) =>
  ({
    item: { id: itemId },
    preset: { id: itemId + 100, name, bpm },
  }) as unknown as SetlistEntry;

describe('activeSetOf', () => {
  const setlists = [
    summary(1, 'Practice', false, 2),
    summary(2, 'Wedding set', true, 3),
  ];
  const entries = {
    1: [entry(10), entry(11)],
    2: [entry(20), entry(21), entry(22)],
  };

  it('places the loaded song inside the active set', () => {
    expect(activeSetOf(setlists, entries, 22)).toEqual({
      id: 2,
      name: 'Wedding set',
      count: 3,
      position: 3,
    });
  });

  it('has no position for a song loaded from elsewhere', () => {
    expect(activeSetOf(setlists, entries, 10)?.position).toBeUndefined();
    expect(activeSetOf(setlists, entries, null)?.position).toBeUndefined();
  });

  it('is empty when no set is active', () => {
    expect(
      activeSetOf([summary(1, 'Practice', false, 2)], entries, 10),
    ).toBeUndefined();
  });
});

describe('song chip', () => {
  const set = { id: 2, name: 'Test gig', count: 4, position: 2 };

  it('shows the song over the setlist and its position', () => {
    expect(stageChipText('Ballad in G', set)).toEqual({
      title: 'Ballad in G',
      context: 'Test gig · 2/4',
    });
    expect(songChipA11yLabel('Ballad in G', set)).toBe(
      'Ballad in G, Setlist Test gig, song 2 of 4',
    );
  });

  it('says a song loaded on its own is not in a setlist', () => {
    expect(soloChipText('Ballad in G')).toEqual({
      title: 'Ballad in G',
      context: NOT_IN_SETLIST,
    });
  });

  it('has nothing to show with no song and no setlist', () => {
    expect(soloChipText(undefined)).toBeUndefined();
  });

  it('names the song a step would load', () => {
    expect(stepA11yLabel(SONG_STEP.next, entry(1, 'Shuffle'))).toBe(
      'Next song, Shuffle',
    );
    expect(stepA11yLabel(SONG_STEP.previous, undefined)).toBe('Previous song');
  });
});

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
