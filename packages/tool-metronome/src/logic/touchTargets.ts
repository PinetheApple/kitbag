// ≥48dp is an acceptance criterion (SPEC §12.6/§12.9), and most controls on
// this screen draw smaller than that because the design fixes their size: 26dp
// LEDs, 24dp stepper keys, a 42dp transport key. They reach the target with
// hitSlop instead of layout.
//
// HONEST LIMIT: hitSlop cannot exceed half the gap to the neighbour without the
// two regions overlapping, at which point the winner is view order, not
// geometry — a tap near a gap would cycle the wrong beat. So a control whose
// neighbour is closer than the shortfall gets the largest slop that stays
// unambiguous, NOT 48dp. Where that leaves a control short, the gap in the
// design is what has to change; flagged for design sign-off.

import { minTouchTargetDp } from '@kitbag/core-design';

/**
 * hitSlop for a control drawn `sizeDp` across, given the TIGHTEST gap to a
 * neighbour in any direction — RN applies a scalar hitSlop to all four sides,
 * so the smallest gap governs (LED rows wrap, and the row gap is tighter than
 * the gap within a group). Pass Infinity for a control with no close neighbour.
 */
export function hitSlopFor(sizeDp: number, neighbourGapDp: number): number {
  const shortfall = (minTouchTargetDp - sizeDp) / 2;
  if (shortfall <= 0) return 0;
  return Math.min(shortfall, neighbourGapDp / 2);
}

/**
 * hitSlop for a text control sized by its label and vertical padding.
 *
 * APPROXIMATE, and deliberately so: it takes the font size for the line height
 * and ignores the hairline border, so the box it assumes is a little smaller
 * than the one drawn and the slop it returns is a little large. Measuring the
 * real line box needs onLayout, which is a per-frame cost for a static number.
 */
export function hitSlopForPadded(
  fontSizeDp: number,
  paddingVerticalDp: number,
  neighbourGapDp: number,
): number {
  return hitSlopFor(fontSizeDp + paddingVerticalDp * 2, neighbourGapDp);
}
