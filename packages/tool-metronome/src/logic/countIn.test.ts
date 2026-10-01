import { KB_COUNT_IN_BARS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  COUNT_IN_BAR_OPTIONS,
  countInActive,
  countInBarsFromOption,
  countInLabel,
} from './countIn.ts';

describe('count-in choices', () => {
  it('offers exactly the engine choices, labelled as the design does', () => {
    expect(COUNT_IN_BAR_OPTIONS.map((o) => o.label)).toEqual([
      'Off',
      '1 bar',
      '2 bars',
      '4 bars',
    ]);
    for (const bars of KB_COUNT_IN_BARS) {
      expect(countInBarsFromOption(String(bars))).toBe(bars);
    }
  });

  it('treats only Off as inactive and never maps an unknown option on', () => {
    expect(countInActive(0)).toBe(false);
    expect(countInActive(2)).toBe(true);
    expect(countInBarsFromOption('3')).toBe(0);
    expect(countInLabel(4)).toBe('4 bars');
  });
});
