import { describe, expect, it } from 'vitest';

import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';

import {
  activeSetOf,
  NO_ACTIVE_SET,
  setlistChipA11yLabel,
  setlistChipLabel,
} from './setlistChip.ts';

describe('setlist chip', () => {
  it('shows the active set and the loaded song position', () => {
    const set = { name: 'Wedding set', count: 12, position: 3 };
    expect(setlistChipLabel(set)).toBe('Wedding set · 3/12');
    expect(setlistChipA11yLabel(set)).toBe('Setlist Wedding set, song 3 of 12');
  });

  it('shows the song count when no song from the set is loaded', () => {
    const set = { name: 'Gig', count: 1, position: undefined };
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
const entry = (itemId: number) =>
  ({ item: { id: itemId } }) as unknown as SetlistEntry;

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
