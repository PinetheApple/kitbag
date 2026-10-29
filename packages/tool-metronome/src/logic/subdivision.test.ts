import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { subdivisionLabel, subdivisionName } from './subdivision.ts';

describe('subdivisionLabel', () => {
  it('shows clicks per beat across the whole range (SPEC §5.2)', () => {
    expect(subdivisionLabel(1)).toBe('×1');
    expect(subdivisionLabel(3)).toBe('×3');
    expect(subdivisionLabel(16)).toBe('×16');
  });
});

describe('subdivisionName', () => {
  it('names every subdivision the engine accepts as the mockup does', () => {
    const names = Array.from(
      { length: KB_SUBDIVISION_BOUNDS.max - KB_SUBDIVISION_BOUNDS.min + 1 },
      (_u, i) => subdivisionName(KB_SUBDIVISION_BOUNDS.min + i),
    );
    expect(names).toEqual([
      'Quarters',
      'Eighths',
      'Triplets',
      'Sixteenths',
      'Quintuplets',
      'Sextuplets',
      'Septuplets',
      '32nds',
      '9 per beat',
      '10 per beat',
      '11 per beat',
      '12 per beat',
      '13 per beat',
      '14 per beat',
      '15 per beat',
      '64ths',
    ]);
  });
});
