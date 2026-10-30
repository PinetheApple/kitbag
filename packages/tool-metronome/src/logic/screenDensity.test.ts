import { describe, expect, it } from 'vitest';

import { screenDensity } from './screenDensity.ts';

describe('screen density', () => {
  it('compacts the tempo zone on a 360 × 800 screen', () => {
    expect(screenDensity(800, 860)).toBe('compact');
  });

  it('keeps the drawn sizes on a 411 × 914 screen', () => {
    expect(screenDensity(914, 860)).toBe('roomy');
  });
});
