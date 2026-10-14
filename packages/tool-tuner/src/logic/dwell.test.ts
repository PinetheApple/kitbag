import { KB_TUNING_STATUS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  DISCRETE_DWELL_MS,
  dwellAt,
  settleDiscrete,
  type DiscreteDwell,
} from './dwell.ts';
import { QUIET_DISCRETE, type TunerDiscrete } from './hop.ts';

const HOP_MS = 43;

const heard = (status: number): TunerDiscrete => ({
  ...QUIET_DISCRETE,
  heard: true,
  status,
  targetMidi: 55,
  currentString: 3,
});
const LOW = heard(KB_TUNING_STATUS.KB_TUNING_TOO_LOW);
const IN_TUNE = heard(KB_TUNING_STATUS.KB_TUNING_IN_TUNE);

// Feed one slice per hop and collect every change of `shown`.
function shownChanges(
  slices: readonly TunerDiscrete[],
  start: TunerDiscrete,
): TunerDiscrete[] {
  let dwell: DiscreteDwell = dwellAt(start);
  const changes: TunerDiscrete[] = [];
  slices.forEach((slice, hop) => {
    const next = settleDiscrete(dwell, slice, hop * HOP_MS);
    if (next.shown !== dwell.shown) changes.push(next.shown);
    dwell = next;
  });
  return changes;
}

const hopsCovering = Math.ceil(DISCRETE_DWELL_MS / HOP_MS) + 1;

describe('settleDiscrete', () => {
  it('passes a change on once it has held for the dwell', () => {
    const slices = Array<TunerDiscrete>(hopsCovering).fill(IN_TUNE);
    expect(shownChanges(slices, LOW)).toEqual([IN_TUNE]);
  });

  it('never passes on a status flickering at hop rate across the edge', () => {
    const slices = Array.from({ length: hopsCovering * 4 }, (_, hop) =>
      hop % 2 === 0 ? IN_TUNE : LOW,
    );
    expect(shownChanges(slices, LOW)).toEqual([]);
  });

  it('drops a change shorter than the dwell', () => {
    const slices = [
      ...Array<TunerDiscrete>(hopsCovering - 2).fill(IN_TUNE),
      ...Array<TunerDiscrete>(hopsCovering).fill(LOW),
    ];
    expect(shownChanges(slices, LOW)).toEqual([]);
  });

  it('treats an equal slice in a new object as no change', () => {
    const dwell = dwellAt(LOW);
    expect(settleDiscrete(dwell, { ...LOW }, DISCRETE_DWELL_MS * 2)).toBe(
      dwell,
    );
  });
});
