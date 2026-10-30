import { KB_DENOMINATORS, KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
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

const PER_BEAT_RANGE = [9, 10, 11, 12, 13, 14, 15].map(
  (n) => `${String(n)} per beat`,
);

const namesIn = (denominator: number) =>
  subdivisionChoices(KB_SUBDIVISION_BOUNDS).map((n) =>
    subdivisionName(n, denominator),
  );

describe('subdivisionName', () => {
  it('names every subdivision in 4/4 as the mockup does', () => {
    expect(namesIn(4)).toEqual([
      'Quarters',
      'Eighths',
      'Triplets',
      'Sixteenths',
      'Quintuplets',
      'Sextuplets',
      'Septuplets',
      '32nds',
      ...PER_BEAT_RANGE,
      '64ths',
    ]);
  });

  it.each([
    { beats: 6, denominator: 8 },
    { beats: 12, denominator: 8 },
  ])(
    'names the note value that plays in $beats/$denominator',
    ({ denominator }) => {
      expect(namesIn(denominator)).toEqual([
        'Eighths',
        'Sixteenths',
        'Triplets',
        '32nds',
        'Quintuplets',
        'Sextuplets',
        'Septuplets',
        '64ths',
        ...PER_BEAT_RANGE,
        '128ths',
      ]);
    },
  );

  it('shifts the power-of-two names with the half and sixteenth beat', () => {
    const powers = [1, 2, 4, 8, 16];
    expect(powers.map((n) => subdivisionName(n, 2))).toEqual([
      'Halves',
      'Quarters',
      'Eighths',
      'Sixteenths',
      '32nds',
    ]);
    expect(powers.map((n) => subdivisionName(n, 16))).toEqual([
      'Sixteenths',
      '32nds',
      '64ths',
      '128ths',
      '256ths',
    ]);
  });

  it('keeps tuplets per beat whatever the denominator', () => {
    expect(KB_DENOMINATORS.map((d) => subdivisionName(3, d))).toEqual(
      KB_DENOMINATORS.map(() => 'Triplets'),
    );
  });

  it('gives every engine denominator and subdivision a distinct name', () => {
    for (const denominator of KB_DENOMINATORS) {
      const names = namesIn(denominator);
      expect(new Set(names).size).toBe(names.length);
      expect(names.join()).not.toMatch(/undefined|NaN/);
    }
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
    expect(spokenSubdivision(3, 4)).toBe('Triplets, 3 per beat');
    expect(spokenSubdivision(2, 8)).toBe('Sixteenths, 2 per beat');
    expect(spokenSubdivision(9, 8)).toBe('9 per beat');
  });
});
