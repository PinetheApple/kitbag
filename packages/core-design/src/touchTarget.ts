import { minTouchTargetDp } from './tokens.ts';

// A slop wider than half the gap to a neighbour overlaps it, and view order,
// not geometry, would pick which control a tap lands on.
export function hitSlopFor(sizeDp: number, neighbourGapDp: number): number {
  const shortfall = (minTouchTargetDp - sizeDp) / 2;
  if (shortfall <= 0) return 0;
  return Math.min(shortfall, neighbourGapDp / 2);
}

// Takes the font size as the line height, so the slop runs slightly large.
export function hitSlopForPadded(
  fontSizeDp: number,
  paddingVerticalDp: number,
  neighbourGapDp: number,
): number {
  return hitSlopFor(fontSizeDp + paddingVerticalDp * 2, neighbourGapDp);
}
