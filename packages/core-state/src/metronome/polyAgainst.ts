import { normalizePolyAgainst } from '@kitbag/core-db';
import {
  KB_POLY_AGAINST_BAR,
  KB_POLY_AGAINST_BOUNDS,
} from '@kitbag/core-native';

import { clamp } from './config.ts';

export { normalizePolyAgainst };

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
  return normalizePolyAgainst(next, beatsPerBar);
}
