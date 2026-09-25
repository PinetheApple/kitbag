import { describe, expect, it } from 'vitest';

import { minTouchTargetDp } from './tokens.ts';
import { hitSlopFor, hitSlopForPadded } from './touchTarget.ts';

const NO_NEIGHBOUR = Number.POSITIVE_INFINITY;

const effectiveTarget = (sizeDp: number, gapDp: number) =>
  sizeDp + hitSlopFor(sizeDp, gapDp) * 2;

describe('hitSlopFor', () => {
  it('lifts a lone small control to the minimum target', () => {
    expect(effectiveTarget(26, NO_NEIGHBOUR)).toBe(minTouchTargetDp);
  });

  it('asks for nothing when the control already meets the target', () => {
    expect(hitSlopFor(minTouchTargetDp, NO_NEIGHBOUR)).toBe(0);
    expect(hitSlopFor(minTouchTargetDp + 10, NO_NEIGHBOUR)).toBe(0);
  });

  it('never lets two neighbours claim the same point', () => {
    for (const gap of [4, 8, 9, 18, 40]) {
      expect(hitSlopFor(26, gap) * 2).toBeLessThanOrEqual(gap);
    }
  });

  it('falls short of the target rather than overlap a close neighbour', () => {
    expect(effectiveTarget(26, 8)).toBeLessThan(minTouchTargetDp);
  });
});

describe('hitSlopForPadded', () => {
  it('counts the padding on both sides of the label', () => {
    expect(hitSlopForPadded(13.5, 12, NO_NEIGHBOUR)).toBe(
      hitSlopFor(13.5 + 24, NO_NEIGHBOUR),
    );
  });

  it('stays bounded by the neighbour gap like the unpadded form', () => {
    expect(hitSlopForPadded(12.5, 6, 8) * 2).toBeLessThanOrEqual(8);
  });
});
