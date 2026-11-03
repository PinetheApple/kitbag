import { describe, expect, it } from 'vitest';

import { fitOneLine, oneLineFloor } from './oneLineFit.ts';

const SIZE = 17;
const MIN = 15;

describe('fitOneLine', () => {
  it('keeps the design size when the text fits', () => {
    expect(
      fitOneLine({ available: 200, textWidth: 150, size: SIZE, floor: MIN }),
    ).toEqual({ fontSize: SIZE, truncates: false });
  });

  it('shrinks in proportion to the overflow while that stays above the floor', () => {
    const fit = fitOneLine({
      available: 140,
      textWidth: 164,
      size: SIZE,
      floor: oneLineFloor(2, SIZE, MIN),
    });
    expect(fit.truncates).toBe(false);
    expect(fit.fontSize).toBeCloseTo((SIZE * 140) / 164);
  });

  it('stops at the floor and truncates when the fit would go below it', () => {
    expect(
      fitOneLine({ available: 100, textWidth: 200, size: SIZE, floor: MIN }),
    ).toEqual({ fontSize: MIN, truncates: true });
  });

  it('does not truncate a fit that lands exactly on the floor', () => {
    expect(
      fitOneLine({ available: 150, textWidth: 170, size: SIZE, floor: MIN }),
    ).toEqual({ fontSize: MIN, truncates: false });
  });
});

describe('oneLineFloor', () => {
  it('is the minimum size at or below the default font scale', () => {
    expect(oneLineFloor(1, SIZE, MIN)).toBe(MIN);
    expect(oneLineFloor(0.85, SIZE, MIN)).toBe(MIN);
  });

  it.each([1.1, 1.3, 2])(
    'never renders below the design size at font scale %d',
    (scale) => {
      expect(oneLineFloor(scale, SIZE, MIN) * scale).toBeCloseTo(SIZE);
    },
  );
});
