import { describe, expect, it } from 'vitest';

import { reorderTarget } from './dragReorder.ts';

describe('reorderTarget', () => {
  it('moves by whole rows of drag and clamps to the list', () => {
    expect(reorderTarget(0, 95, 48, 4)).toBe(2);
    expect(reorderTarget(3, -30, 48, 4)).toBe(2);
    expect(reorderTarget(1, 500, 48, 4)).toBe(3);
    expect(reorderTarget(1, -500, 48, 4)).toBe(0);
  });

  it('stays put for a short drag or an unmeasured row', () => {
    expect(reorderTarget(2, 20, 48, 4)).toBe(2);
    expect(reorderTarget(2, 200, 0, 4)).toBe(2);
  });
});
