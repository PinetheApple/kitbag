import { describe, expect, it } from 'vitest';

import { steppedIndex, wheelIndex } from './wheel.ts';

describe('wheelIndex', () => {
  it('rounds a scroll offset to the nearest item', () => {
    expect(wheelIndex(0, 40, 5)).toBe(0);
    expect(wheelIndex(59, 40, 5)).toBe(1);
    expect(wheelIndex(61, 40, 5)).toBe(2);
  });

  it('stays on the list when overscrolled', () => {
    expect(wheelIndex(-30, 40, 5)).toBe(0);
    expect(wheelIndex(900, 40, 5)).toBe(4);
  });
});

describe('steppedIndex', () => {
  it('stops at either end', () => {
    expect(steppedIndex(0, -1, 4)).toBe(0);
    expect(steppedIndex(3, 1, 4)).toBe(3);
    expect(steppedIndex(1, 1, 4)).toBe(2);
  });
});
