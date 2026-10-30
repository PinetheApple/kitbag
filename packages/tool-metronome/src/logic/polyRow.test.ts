import { describe, expect, it } from 'vitest';

import { polyDotCentres, polyLabelReach, polyRatioLabel } from './polyRow.ts';

describe('poly dot placement', () => {
  const FOUR_BEATS = 4 * 56 + 3 * 12;

  it('places each poly dot at its time in the bar', () => {
    const centres = polyDotCentres(3, FOUR_BEATS, 56, 12);
    expect(centres[0]).toBe(28);
    expect(centres[1]).toBeCloseTo(28 + 272 / 3);
    expect(centres[2]).toBeCloseTo(28 + (2 * 272) / 3);
  });

  it('puts a poly pulse that lands on a beat under that beat', () => {
    const centres = polyDotCentres(2, FOUR_BEATS, 56, 12);
    const thirdBeatCentre = 28 + 2 * 68;
    expect(centres[1]).toBe(thirdBeatCentre);
  });
});

describe('poly label', () => {
  it('sits its full reach left of the row when there is room', () => {
    expect(polyLabelReach(36, 34, 16)).toBe(36);
  });

  it('stops at the screen edge on a full-width bar', () => {
    expect(polyLabelReach(36, 0, 16)).toBe(16);
  });

  it('reads poly beats against the bar', () => {
    expect(polyRatioLabel(3, 4)).toBe('3:4');
  });
});
