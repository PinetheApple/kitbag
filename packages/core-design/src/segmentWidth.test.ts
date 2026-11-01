import { describe, expect, it } from 'vitest';

import { equalOptionMinWidth } from './segmentWidth.ts';

describe('equal-width segment options', () => {
  it('sizes every option to the widest label plus its padding', () => {
    expect(equalOptionMinWidth([21, 17], 10)).toEqual({ minWidth: 41 });
  });

  it('keeps a lone option at its own width', () => {
    expect(equalOptionMinWidth([21], 10)).toEqual({ minWidth: 41 });
  });
});
