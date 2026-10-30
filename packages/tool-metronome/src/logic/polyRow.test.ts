import { describe, expect, it } from 'vitest';

import { polyDotCentres, polyLabelPlace, polyRatioLabel } from './polyRow.ts';

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
  const ROOM = {
    labelWidth: 20,
    labelHeight: 15,
    rowHeight: 22,
    labelGap: 8,
    sideRoom: 34,
    screenInset: 16,
    afterLastDot: 0,
  };

  it('sits left of the row when the margin holds it', () => {
    expect(polyLabelPlace(ROOM)).toBe('left');
  });

  it('follows the last poly dot on a full-width bar with room after it', () => {
    expect(
      polyLabelPlace({
        ...ROOM,
        labelWidth: 27,
        sideRoom: 0,
        afterLastDot: 69,
      }),
    ).toBe('right');
  });

  it('moves above the row when large text is taller than the dots', () => {
    expect(polyLabelPlace({ ...ROOM, labelHeight: 30 })).toBe('above');
  });

  it('moves above the row when neither side holds it', () => {
    expect(
      polyLabelPlace({
        ...ROOM,
        labelWidth: 52,
        sideRoom: 0,
        afterLastDot: 20,
      }),
    ).toBe('above');
  });

  it('reads poly beats against the bar', () => {
    expect(polyRatioLabel(3, 4)).toBe('3:4');
  });
});
