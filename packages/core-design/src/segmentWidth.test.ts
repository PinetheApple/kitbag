import { describe, expect, it } from 'vitest';

import { equalOptionSize } from './segmentWidth.ts';

describe('equal-width segment options', () => {
  it('sizes every option to the widest label plus its padding', () => {
    expect(equalOptionSize([21, 17], 10)).toEqual({ minWidth: 41 });
  });

  it('keeps a lone option at its own width', () => {
    expect(equalOptionSize([21], 10)).toEqual({ minWidth: 41 });
  });

  it('sets a floor, never a fixed width a larger font could overflow', () => {
    expect(equalOptionSize([21, 17], 10)).not.toHaveProperty('width');
  });
});
