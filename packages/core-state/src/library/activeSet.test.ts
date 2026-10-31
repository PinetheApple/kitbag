import { describe, expect, it } from 'vitest';

import { activeSetView } from './activeSet.ts';
import type { SetlistEntry, SetlistSummary } from './snapshot.ts';

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

const entry = (itemId: number, name = '', bpm = 120, presetId = itemId) =>
  ({
    item: { id: itemId },
    preset: { id: presetId, name, bpm },
  }) as unknown as SetlistEntry;

const loadedFrom = (setlistId: number | null, itemId: number | null) => ({
  presetId: 1,
  itemId,
  setlistId,
});

describe('activeSetView', () => {
  const setlists = [
    summary(1, 'Practice', false, 2),
    summary(2, 'Wedding set', true, 3),
  ];
  const entries = {
    1: [entry(10), entry(11)],
    2: [entry(20), entry(21), entry(22)],
  };

  it('places the loaded song inside the active set', () => {
    expect(activeSetView(setlists, entries, loadedFrom(2, 22))).toEqual({
      id: 2,
      name: 'Wedding set',
      count: 3,
      position: 3,
    });
  });

  it('places a song listed twice by its setlist item', () => {
    const twice = {
      2: [entry(20, 'A', 120, 7), entry(21), entry(22, 'A', 120, 7)],
    };
    expect(activeSetView(setlists, twice, loadedFrom(2, 22))?.position).toBe(3);
  });

  it('is on stage with no position when nothing or a removed song is loaded', () => {
    expect(activeSetView(setlists, entries, null)?.position).toBeUndefined();
    const removed = activeSetView(setlists, entries, loadedFrom(2, 99));
    expect(removed).toMatchObject({ id: 2, position: undefined });
  });

  it('is off stage while a song from outside the set is loaded', () => {
    expect(
      activeSetView(setlists, entries, loadedFrom(null, null)),
    ).toBeUndefined();
    expect(activeSetView(setlists, entries, loadedFrom(1, 10))).toBeUndefined();
  });

  it('is empty when no set is active', () => {
    expect(
      activeSetView(
        [summary(1, 'Practice', false, 2)],
        entries,
        loadedFrom(1, 10),
      ),
    ).toBeUndefined();
  });
});
