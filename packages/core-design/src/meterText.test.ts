import { describe, expect, it } from 'vitest';

import { meterLabel, meterRowValue, tenthsClock } from './meterText.ts';

describe('meter text', () => {
  it('labels a meter in quarter notes', () => {
    expect(meterLabel(3)).toBe('3/4');
  });

  it('marks an override as yours', () => {
    expect(meterRowValue(4, false)).toBe('4/4');
    expect(meterRowValue(3, true)).toBe('3/4 · yours');
  });

  it.each([
    [0, '0:00.0'],
    [2.34, '0:02.3'],
    [105.3, '1:45.3'],
    [59.96, '1:00.0'],
    [-1, '0:00.0'],
    [Number.NaN, '0:00.0'],
    [Number.POSITIVE_INFINITY, '0:00.0'],
    [Number.NEGATIVE_INFINITY, '0:00.0'],
    [3600, '1:00:00.0'],
    [3725.46, '1:02:05.5'],
    [3599.96, '1:00:00.0'],
  ])('clocks %f s as %s', (seconds, text) => {
    expect(tenthsClock(seconds)).toBe(text);
  });
});
