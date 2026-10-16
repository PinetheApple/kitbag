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

type Side = 'top' | 'right' | 'bottom' | 'left';

/** Gap in dp to the nearest other control on each side; omit a side with none. */
export type NeighbourGaps = Readonly<Partial<Record<Side, number | undefined>>>;

export type HitExtension = Readonly<Record<Side, number>>;

const NONE = Number.POSITIVE_INFINITY;

// A gap is split with the control across it. Room no other control reaches
// into (padding, a scroll edge, a non-control sibling) may be taken whole.
export function unshared(roomDp: number): number {
  return roomDp * 2;
}

export function neighbourGaps(
  gaps: number | NeighbourGaps = {},
): NeighbourGaps {
  return typeof gaps === 'number'
    ? { top: gaps, right: gaps, bottom: gaps, left: gaps }
    : gaps;
}

// Each side takes at most half its gap, so two neighbours meet at the gap's
// midpoint: whichever control is nearer a touch wins it, whatever the view
// order. What one side cannot take spills to the opposite side.
function extendAxis(sizeDp: number, gapA: number, gapB: number) {
  const need = Math.max(0, minTouchTargetDp - sizeDp);
  const capA = gapA / 2;
  const capB = gapB / 2;
  const b = Math.min(need - Math.min(need / 2, capA), capB);
  const a = Math.min(need - b, capA);
  return [a, b] as const;
}

// Unmeasured lines take the conservative line gap on both sides.
export function wrappedLineGaps(
  lineTop: number | undefined,
  lineTops: readonly number[],
  outer: NeighbourGaps,
  lineGapDp: number,
): NeighbourGaps {
  if (lineTop === undefined) return { top: lineGapDp, bottom: lineGapDp };
  return {
    top: lineTop === Math.min(...lineTops) ? outer.top : lineGapDp,
    bottom: lineTop === Math.max(...lineTops) ? outer.bottom : lineGapDp,
  };
}

export function hitExtension(
  widthDp: number,
  heightDp: number,
  gaps: NeighbourGaps,
): HitExtension {
  const [top, bottom] = extendAxis(
    heightDp,
    gaps.top ?? NONE,
    gaps.bottom ?? NONE,
  );
  const [left, right] = extendAxis(
    widthDp,
    gaps.left ?? NONE,
    gaps.right ?? NONE,
  );
  return { top, right, bottom, left };
}

// Grows a box by `ext` and hands it back as negative margin, so nothing moves.
// A scrolling or clipping ancestor still cuts it off, as does any later sibling
// that forms a native view over it.
export function hitBoxStyle(ext: HitExtension) {
  return {
    paddingTop: ext.top,
    paddingRight: ext.right,
    paddingBottom: ext.bottom,
    paddingLeft: ext.left,
    marginTop: -ext.top,
    marginRight: -ext.right,
    marginBottom: -ext.bottom,
    marginLeft: -ext.left,
  };
}
