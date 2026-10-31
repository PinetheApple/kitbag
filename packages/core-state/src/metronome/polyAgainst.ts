import {
  KB_POLY_AGAINST_BAR,
  KB_POLY_AGAINST_BOUNDS,
} from '@kitbag/core-native';

import { clamp } from './config.ts';

function isExplicit(against: number): boolean {
  return (
    Number.isInteger(against) &&
    against >= KB_POLY_AGAINST_BOUNDS.min &&
    against <= KB_POLY_AGAINST_BOUNDS.max
  );
}

export function normalizePolyAgainst(
  against: number,
  beatsPerBar: number,
): number {
  if (!isExplicit(against)) return KB_POLY_AGAINST_BAR;
  // Owner rule pending: an explicit count equal to the bar stays explicit.
  // Return KB_POLY_AGAINST_BAR here instead to make it follow later meters.
  if (against === beatsPerBar) return against;
  return against;
}

export function effectivePolyAgainst(
  against: number,
  beatsPerBar: number,
): number {
  return against === KB_POLY_AGAINST_BAR ? beatsPerBar : against;
}

export function stepPolyAgainst(
  against: number,
  delta: number,
  beatsPerBar: number,
): number {
  const next = clamp(
    effectivePolyAgainst(against, beatsPerBar) + delta,
    KB_POLY_AGAINST_BOUNDS.min,
    KB_POLY_AGAINST_BOUNDS.max,
  );
  if (next === effectivePolyAgainst(against, beatsPerBar)) return against;
  return next === beatsPerBar ? KB_POLY_AGAINST_BAR : next;
}
