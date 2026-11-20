import { describe, expect, it } from 'vitest';

import { setlistPicks } from './setlistPicker.ts';
import {
  ENTRY_KIND,
  type SetlistEntry,
  type SetlistSummary,
} from './snapshot.ts';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;

const stem = (stemSetId: number) =>
  ({ kind: ENTRY_KIND.stem, item: {}, stemSetId }) as SetlistEntry;
const click = { kind: ENTRY_KIND.preset, item: {}, preset: {} } as SetlistEntry;
const summary = (id: number, name: string, active: boolean) =>
  ({
    setlist: { id, name, active },
    songCount: 3,
    rampCount: 0,
  }) as SetlistSummary;

describe('setlist picks for a stem song', () => {
  const setlists = [summary(1, 'Gig', true), summary(2, 'Rehearsal', false)];
  const entries = { 1: [stem(NIGHT_BUS), click, stem(TIN_ROOF)], 2: [click] };

  it('counts stem songs apart and marks a setlist that already holds it', () => {
    expect(setlistPicks({ setlists, entries }, NIGHT_BUS)).toEqual([
      {
        id: 1,
        name: 'Gig',
        onStage: true,
        songCount: 3,
        stemCount: 2,
        holds: true,
      },
      {
        id: 2,
        name: 'Rehearsal',
        onStage: false,
        songCount: 3,
        stemCount: 0,
        holds: false,
      },
    ]);
  });

  it('marks nothing held when there is no song', () => {
    const picks = setlistPicks({ setlists, entries: {} }, null);
    expect(picks.map((pick) => [pick.stemCount, pick.holds])).toEqual([
      [0, false],
      [0, false],
    ]);
  });
});
