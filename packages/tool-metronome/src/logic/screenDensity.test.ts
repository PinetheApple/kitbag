import { describe, expect, it } from 'vitest';

import { screenDensity } from './screenDensity.ts';

const ROOMY = {
  windowHeight: 914,
  compactBelowHeight: 860,
  overflowedWhenRoomy: false,
};

describe('screen density', () => {
  it('compacts the tempo zone on a 360 × 800 screen', () => {
    expect(screenDensity({ ...ROOMY, windowHeight: 800 })).toBe('compact');
  });

  it('keeps the drawn sizes on a 411 × 914 screen', () => {
    expect(screenDensity(ROOMY)).toBe('roomy');
  });

  it('compacts a tall screen whose content overflowed at the drawn sizes', () => {
    expect(
      screenDensity({ ...ROOMY, windowHeight: 891, overflowedWhenRoomy: true }),
    ).toBe('compact');
  });
});
