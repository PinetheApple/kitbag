import { describe, expect, it } from 'vitest';

import { equalOptionWidth } from './segmentWidth.ts';

describe('equal-width segment options', () => {
  it('gives every option the mean label width plus its padding', () => {
    expect(equalOptionWidth([21, 17], 10)).toBe(39);
  });

  it('keeps a lone option at its own width', () => {
    expect(equalOptionWidth([21], 10)).toBe(41);
  });
});
