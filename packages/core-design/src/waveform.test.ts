import { describe, expect, it } from 'vitest';

import { waveBarHeights } from './waveform.ts';

describe('waveBarHeights', () => {
  it('floors quiet bars and clamps loud ones', () => {
    expect(waveBarHeights([0, 0.5, 2], 3, 0.1)).toEqual(['10%', '50%', '100%']);
  });

  it('reads the envelope at each bar position when the counts differ', () => {
    expect(waveBarHeights([0.2, 0.4], 4, 0)).toEqual([
      '20%',
      '20%',
      '40%',
      '40%',
    ]);
    expect(waveBarHeights([0.2, 0.4, 0.6, 0.8], 2, 0)).toEqual(['20%', '60%']);
  });

  it('draws the floor everywhere before the envelope arrives', () => {
    expect(waveBarHeights(null, 2, 0.08)).toEqual(['8%', '8%']);
  });
});
