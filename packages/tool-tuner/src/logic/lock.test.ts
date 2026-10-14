import {
  KB_TUNER_NO_STRING,
  KB_TUNER_TUNED_RATIO,
  KB_TUNING_STATUS,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { TunerHop } from './hop.ts';
import {
  followNeedle,
  lockFired,
  NEEDLE_FOLLOW_MS,
  nextLatch,
} from './lock.ts';

function hop(
  currentString: number,
  inTuneRatio: number,
  canHear = true,
): TunerHop {
  return {
    id: 0,
    canHear,
    currentString,
    wrongString: KB_TUNER_NO_STRING,
    wrongDirection: 0,
    status: KB_TUNING_STATUS.KB_TUNING_IN_TUNE,
    targetMidi: 55,
    errorCents: 0,
    inTuneRatio,
    paused: false,
    noSound: false,
  };
}

// Run a sequence of hops through the latch and collect the strings reported.
function locksReported(hops: readonly TunerHop[]): number[] {
  const reported: number[] = [];
  let latched = KB_TUNER_NO_STRING;
  for (const h of hops) {
    const next = nextLatch(h);
    if (lockFired(latched, next)) reported.push(next);
    latched = next;
  }
  return reported;
}

const LOCKED = KB_TUNER_TUNED_RATIO;
const RISING = KB_TUNER_TUNED_RATIO / 2;

describe('lock event', () => {
  it('fires once when the ratio reaches the tuned ratio, not every hop after', () => {
    expect(
      locksReported([hop(3, RISING), hop(3, LOCKED), hop(3, 1), hop(3, 1)]),
    ).toEqual([3]);
  });

  it('fires again only after the ratio drops back below', () => {
    expect(
      locksReported([hop(3, LOCKED), hop(3, 1), hop(3, 0), hop(3, LOCKED)]),
    ).toEqual([3, 3]);
  });

  it('re-arms when the note decays', () => {
    expect(locksReported([hop(3, 1), hop(3, 1, false), hop(3, 1)])).toEqual([
      3, 3,
    ]);
  });

  it('reports each string it locks on', () => {
    expect(locksReported([hop(3, 1), hop(2, 1)])).toEqual([3, 2]);
  });

  it('never fires without a string (chromatic)', () => {
    expect(locksReported([hop(KB_TUNER_NO_STRING, 1)])).toEqual([]);
  });
});

describe('followNeedle', () => {
  it('moves part of the way per frame and never overshoots', () => {
    const next = followNeedle(0, 1, 16, false);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
    expect(
      followNeedle(0, 1, NEEDLE_FOLLOW_MS * 20, false),
    ).toBeLessThanOrEqual(1);
  });

  it('is frame-rate independent', () => {
    const twoShort = followNeedle(followNeedle(0, 1, 8, false), 1, 8, false);
    expect(twoShort).toBeCloseTo(followNeedle(0, 1, 16, false), 12);
  });

  it('jumps under reduced motion', () => {
    expect(followNeedle(0, 0.7, 16, true)).toBe(0.7);
  });

  it('holds still on a zero or negative interval', () => {
    expect(followNeedle(0.2, 1, 0, false)).toBe(0.2);
    expect(followNeedle(0.2, 1, -5, false)).toBe(0.2);
  });
});
