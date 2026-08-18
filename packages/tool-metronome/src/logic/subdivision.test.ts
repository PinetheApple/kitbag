import { describe, expect, it } from 'vitest';

import { subdivisionGlyph } from './subdivision.ts';

describe('subdivisionGlyph', () => {
  it('shows the named glyphs for 1-4 (SPEC §5.2)', () => {
    expect([1, 2, 3, 4].map(subdivisionGlyph)).toEqual(['♩', '♪', '³', '♬']);
  });

  it('shows ×N from 5 to the top of the range', () => {
    expect(subdivisionGlyph(5)).toBe('×5');
    expect(subdivisionGlyph(16)).toBe('×16');
  });
});
