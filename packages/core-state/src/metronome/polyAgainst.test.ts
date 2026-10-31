import {
  KB_POLY_AGAINST_BAR,
  KB_POLY_AGAINST_BOUNDS,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  effectivePolyAgainst,
  normalizePolyAgainst,
  stepPolyAgainst,
} from './polyAgainst.ts';

const FOUR = 4;

describe('poly against normalisation', () => {
  it('keeps the bar sentinel', () => {
    expect(normalizePolyAgainst(KB_POLY_AGAINST_BAR, FOUR)).toBe(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('keeps an explicit count equal to the bar explicit', () => {
    expect(normalizePolyAgainst(FOUR, FOUR)).toBe(FOUR);
  });

  it.each([
    KB_POLY_AGAINST_BOUNDS.min - 2,
    KB_POLY_AGAINST_BOUNDS.max + 1,
    2.5,
    Number.NaN,
  ])('reads %s as the bar', (against) => {
    expect(normalizePolyAgainst(against, FOUR)).toBe(KB_POLY_AGAINST_BAR);
  });

  it('keeps explicit counts inside the engine bounds', () => {
    expect(normalizePolyAgainst(KB_POLY_AGAINST_BOUNDS.min, FOUR)).toBe(
      KB_POLY_AGAINST_BOUNDS.min,
    );
    expect(normalizePolyAgainst(KB_POLY_AGAINST_BOUNDS.max, FOUR)).toBe(
      KB_POLY_AGAINST_BOUNDS.max,
    );
  });
});

describe('poly against stepping', () => {
  it('lands on the bar when stepping through the beats per bar', () => {
    expect(stepPolyAgainst(3, 1, FOUR)).toBe(KB_POLY_AGAINST_BAR);
    expect(stepPolyAgainst(5, -1, FOUR)).toBe(KB_POLY_AGAINST_BAR);
  });

  it('leaves the bar for the counts either side of it', () => {
    expect(stepPolyAgainst(KB_POLY_AGAINST_BAR, 1, FOUR)).toBe(5);
    expect(stepPolyAgainst(KB_POLY_AGAINST_BAR, -1, FOUR)).toBe(3);
  });

  it('steps an explicit count that a meter change made equal to the bar', () => {
    expect(stepPolyAgainst(3, 1, 3)).toBe(4);
    expect(stepPolyAgainst(3, -1, 3)).toBe(2);
  });

  it('stops at the engine bounds', () => {
    expect(stepPolyAgainst(KB_POLY_AGAINST_BOUNDS.min, -1, FOUR)).toBe(
      KB_POLY_AGAINST_BOUNDS.min,
    );
    expect(stepPolyAgainst(KB_POLY_AGAINST_BOUNDS.max, 1, FOUR)).toBe(
      KB_POLY_AGAINST_BOUNDS.max,
    );
    expect(stepPolyAgainst(KB_POLY_AGAINST_BAR, 1, 16)).toBe(
      KB_POLY_AGAINST_BAR,
    );
    expect(stepPolyAgainst(KB_POLY_AGAINST_BAR, -1, 1)).toBe(
      KB_POLY_AGAINST_BAR,
    );
  });
});

describe('effective poly against', () => {
  it('follows the bar under the sentinel', () => {
    expect(effectivePolyAgainst(KB_POLY_AGAINST_BAR, 7)).toBe(7);
  });

  it('ignores the meter for an explicit count', () => {
    expect(effectivePolyAgainst(2, 7)).toBe(2);
  });
});
