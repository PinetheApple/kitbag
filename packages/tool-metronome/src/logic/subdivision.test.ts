import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  inRows,
  spokenSubdivision,
  subdivisionChoices,
  subdivisionColumns,
  subdivisionLabel,
  subdivisionName,
} from './subdivision.ts';

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

describe('subdivisionChoices', () => {
  it('lists every subdivision the engine accepts, in order', () => {
    const choices = subdivisionChoices(KB_SUBDIVISION_BOUNDS);
    expect(choices[0]).toBe(KB_SUBDIVISION_BOUNDS.min);
    expect(choices.at(-1)).toBe(KB_SUBDIVISION_BOUNDS.max);
    expect(choices).toHaveLength(
      KB_SUBDIVISION_BOUNDS.max - KB_SUBDIVISION_BOUNDS.min + 1,
    );
  });
});

describe('subdivision tile grid', () => {
  it('uses four columns, two at large text', () => {
    expect(subdivisionColumns(1)).toBe(4);
    expect(subdivisionColumns(2)).toBe(2);
  });

  it('fills rows left to right and leaves the last one short', () => {
    expect(inRows([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
  });
});

describe('spokenSubdivision', () => {
  it('adds the count to a named subdivision only', () => {
    expect(spokenSubdivision(3)).toBe('Triplets, 3 per beat');
    expect(spokenSubdivision(9)).toBe('9 per beat');
  });
});
