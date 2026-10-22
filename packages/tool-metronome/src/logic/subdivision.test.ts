import { describe, expect, it } from 'vitest';

import { subdivisionLabel } from './subdivision.ts';

describe('subdivisionLabel', () => {
  it('shows clicks per beat across the whole range (SPEC §5.2)', () => {
    expect(subdivisionLabel(1)).toBe('×1');
    expect(subdivisionLabel(3)).toBe('×3');
    expect(subdivisionLabel(16)).toBe('×16');
  });
});
