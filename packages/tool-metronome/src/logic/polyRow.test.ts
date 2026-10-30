import { describe, expect, it } from 'vitest';

import { polyDotCentres, polyLabelBeside, polyRatioLabel } from './polyRow.ts';

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
  it('sits beside the row when the margin holds it', () => {
    expect(polyLabelBeside(20, 8, 34, 16)).toBe(true);
  });

  it('moves above the row when the bar fills the width', () => {
    expect(polyLabelBeside(27, 8, 0, 16)).toBe(false);
  });

  it('moves above the row when large text widens it', () => {
    expect(polyLabelBeside(52, 8, 34, 16)).toBe(false);
  });

  it('reads poly beats against the bar', () => {
    expect(polyRatioLabel(3, 4)).toBe('3:4');
  });
});
