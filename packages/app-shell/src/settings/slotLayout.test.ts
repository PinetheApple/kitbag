import { describe, expect, it } from 'vitest';

import { slotLayout } from './slotLayout.ts';

describe('slot layout', () => {
  it('wraps slots into rows of at most the given width', () => {
    expect(slotLayout(6, 4)).toEqual([[[0, 1, 2, 3]], [[4, 5]]]);
    expect(slotLayout(1, 4)).toEqual([[[0]]]);
  });
});
