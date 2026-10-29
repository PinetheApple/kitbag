import { KB_COUNT_IN_BARS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  COUNT_IN_BAR_OPTIONS,
  COUNT_IN_MODE_OPTIONS,
  COUNT_IN_SEGMENT_OPTIONS,
  countInMode,
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

  it('never maps an unknown option on', () => {
    expect(countInBarsFromOption('3')).toBe(0);
    expect(countInLabel(4)).toBe('4 bars');
  });

  it('labels the segments with the bare count and speaks the bars', () => {
    expect(COUNT_IN_SEGMENT_OPTIONS.map((o) => o.label)).toEqual([
      'Off',
      '1',
      '2',
      '4',
    ]);
    expect(COUNT_IN_SEGMENT_OPTIONS[1]?.accessibilityLabel).toBe('1 bar');
    expect(COUNT_IN_SEGMENT_OPTIONS.map((o) => o.value)).toEqual(
      KB_COUNT_IN_BARS.map(String),
    );
  });

  it('orders the count sound Same then Distinct', () => {
    expect(COUNT_IN_MODE_OPTIONS.map((o) => o.label)).toEqual([
      'Same',
      'Distinct',
    ]);
    expect(countInMode(true)).toBe('distinct');
    expect(countInMode(false)).toBe('same');
  });
});
