import { describe, expect, it } from 'vitest';

import { minTouchTargetDp } from './tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  hitSlopFor,
  hitSlopForPadded,
} from './touchTarget.ts';

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

describe('hitExtension', () => {
  const total = (size: number, a: number, b: number) => size + a + b;

  it('reaches the minimum target with room on every side', () => {
    const ext = hitExtension(24, 24, {});
    expect(total(24, ext.left, ext.right)).toBe(minTouchTargetDp);
    expect(total(24, ext.top, ext.bottom)).toBe(minTouchTargetDp);
  });

  it('stops at the midpoint of each gap, so neighbours never overlap', () => {
    const ext = hitExtension(24, 24, {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
    expect(ext).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
  });

  it('spills what a tight side cannot take onto the open side', () => {
    const ext = hitExtension(24, 24, { bottom: 10 });
    expect(ext.bottom).toBe(5);
    expect(total(24, ext.top, ext.bottom)).toBe(minTouchTargetDp);
  });

  it('asks for nothing on an axis already at the target', () => {
    expect(hitExtension(minTouchTargetDp, minTouchTargetDp, {})).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe('hitBoxStyle', () => {
  it('gives back every dp of growth as margin, so layout does not move', () => {
    const style = hitBoxStyle({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(style.paddingTop + style.marginTop).toBe(0);
    expect(style.paddingRight + style.marginRight).toBe(0);
    expect(style.paddingBottom + style.marginBottom).toBe(0);
    expect(style.paddingLeft + style.marginLeft).toBe(0);
  });
});
