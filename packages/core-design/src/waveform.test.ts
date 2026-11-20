import { describe, expect, it } from 'vitest';

import { waveBarHeights, waveBarsPath } from './waveform.ts';

describe('waveBarHeights', () => {
  it('floors quiet bars and clamps loud ones', () => {
    expect(waveBarHeights([0, 0.5, 2], 3, 0.1)).toEqual([0.1, 0.5, 1]);
  });

  it('reads the envelope at each bar position when the counts differ', () => {
    expect(waveBarHeights([0.2, 0.4], 4, 0)).toEqual([0.2, 0.2, 0.4, 0.4]);
    expect(waveBarHeights([0.2, 0.4, 0.6, 0.8], 2, 0)).toEqual([0.2, 0.6]);
  });

  it('draws the floor everywhere before the envelope arrives', () => {
    expect(waveBarHeights(null, 2, 0.08)).toEqual([0.08, 0.08]);
  });
});

describe('waveBarsPath', () => {
  const lane = { width: 10, height: 10, gap: 2, radius: 1 };

  it('shares the width left after the gaps and centres each bar vertically', () => {
    expect(waveBarsPath([1, 0.5], lane)).toBe(
      'M1 0H3A1 1 0 0 1 4 1V9A1 1 0 0 1 3 10H1A1 1 0 0 1 0 9V1A1 1 0 0 1 1 0Z' +
        'M7 2.5H9A1 1 0 0 1 10 3.5V6.5A1 1 0 0 1 9 7.5H7A1 1 0 0 1 6 6.5V3.5A1 1 0 0 1 7 2.5Z',
    );
  });

  it('caps the corner radius at half the narrower side', () => {
    expect(waveBarsPath([1], { ...lane, width: 1 })).toBe(
      'M0.5 0H0.5A0.5 0.5 0 0 1 1 0.5V9.5A0.5 0.5 0 0 1 0.5 10H0.5A0.5 0.5 0 0 1 0 9.5V0.5A0.5 0.5 0 0 1 0.5 0Z',
    );
  });

  it('draws nothing before the lane is measured or when the gaps fill it', () => {
    expect(waveBarsPath([1, 1], { ...lane, width: 0 })).toBe('');
    expect(waveBarsPath([1, 1], { ...lane, width: 2 })).toBe('');
  });
});
