import {
  KB_TUNER_NO_STRING,
  KB_TUNER_TUNED_RATIO,
  KB_TUNING_STATUS,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { TunerHop } from './hop.ts';
import {
  followNeedle,
  lockArmed,
  lockFired,
  nextArmed,
  NEEDLE_FOLLOW_MS,
  nextLatch,
} from './lock.ts';

function hop(
  currentString: number,
  inTuneRatio: number,
  canHear = true,
  id = 1,
): TunerHop {
  return {
    id,
    canHear,
    currentString,
    wrongString: KB_TUNER_NO_STRING,
    wrongDirection: 0,
    status: KB_TUNING_STATUS.KB_TUNING_IN_TUNE,
    targetMidi: 55,
    errorCents: 0,
    inTuneRatio,
    inTuneThresholdCents: 7,
    paused: false,
    noSound: false,
  };
}

// Run a sequence of hops through the latch and collect the strings reported.
function locksReported(
  hops: readonly TunerHop[],
  resetId = Number.NEGATIVE_INFINITY,
  armedAtStart = true,
): number[] {
  const reported: number[] = [];
  let latched = KB_TUNER_NO_STRING;
  let armed = armedAtStart;
  for (const h of hops) {
    armed = nextArmed(armed, h, resetId);
    const next = nextLatch(h, armed);
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

  it('ignores locked hops after a reset until one is heard unlocked', () => {
    const afterReset = (hops: TunerHop[]) => locksReported(hops, 10, false);
    expect(afterReset([hop(3, 1, true, 9), hop(3, 1, true, 10)])).toEqual([]);
    // Measured after the reset but before the engine applied the change.
    expect(afterReset([hop(3, 1, true, 11), hop(3, 1, true, 12)])).toEqual([]);
    expect(
      afterReset([
        hop(3, 1, true, 11),
        hop(2, RISING, true, 12),
        hop(2, 1, true, 13),
      ]),
    ).toEqual([2]);
  });

  it('does not let a pre-reset unlocked hop arm the lock', () => {
    expect(
      locksReported([hop(3, RISING, true, 10), hop(3, 1, true, 11)], 10, false),
    ).toEqual([]);
  });
});

describe('lockArmed', () => {
  it('admits only hops after the reset, and none before one is recorded', () => {
    expect(lockArmed(10, 10)).toBe(false);
    expect(lockArmed(10, 11)).toBe(true);
    expect(lockArmed(Number.NaN, 11)).toBe(false);
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
