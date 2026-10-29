import { KB_DENOMINATORS, KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  commonMeters,
  meterLabel,
  numeratorChoices,
  sameMeter,
} from './meter.ts';

describe('numeratorChoices', () => {
  it('runs from one beat to the engine maximum', () => {
    const choices = numeratorChoices(KB_MAX_BEATS);
    expect(choices[0]).toBe(1);
    expect(choices.at(-1)).toBe(KB_MAX_BEATS);
    expect(choices).toHaveLength(KB_MAX_BEATS);
  });

  it('is empty when the engine allows no beats', () => {
    expect(numeratorChoices(0)).toEqual([]);
  });
});

describe('commonMeters', () => {
  it('offers the mockup chips the engine allows', () => {
    expect(commonMeters(KB_MAX_BEATS, KB_DENOMINATORS).map(meterLabel)).toEqual(
      ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8'],
    );
  });

  it('skips chips over the beat limit or on a denominator the engine lacks', () => {
    expect(commonMeters(8, [4]).map(meterLabel)).toEqual([
      '2/4',
      '3/4',
      '4/4',
      '5/4',
    ]);
  });
});

describe('sameMeter', () => {
  it('needs both parts to match', () => {
    expect(
      sameMeter({ beats: 6, denominator: 8 }, { beats: 6, denominator: 8 }),
    ).toBe(true);
    expect(
      sameMeter({ beats: 6, denominator: 8 }, { beats: 6, denominator: 4 }),
    ).toBe(false);
  });
});
