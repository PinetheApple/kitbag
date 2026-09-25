import { minTouchTargetDp } from './tokens.ts';

// Slop past half the neighbour gap overlaps it, and view order, not geometry,
// then decides which control a tap hits.
export function hitSlopFor(sizeDp: number, neighbourGapDp: number): number {
  const shortfall = (minTouchTargetDp - sizeDp) / 2;
  if (shortfall <= 0) return 0;
  return Math.min(shortfall, neighbourGapDp / 2);
}

export function hitSlopForPadded(
  fontSizeDp: number,
  paddingVerticalDp: number,
  neighbourGapDp: number,
): number {
  return hitSlopFor(fontSizeDp + paddingVerticalDp * 2, neighbourGapDp);
}
