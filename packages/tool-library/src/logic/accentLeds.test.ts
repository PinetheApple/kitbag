import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  accentLedLabel,
  accentLedLayout,
  accentLedState,
  SHEET_LEDS_PER_ROW,
} from './accentLeds.ts';

const BEATS_IN_FOUR = 4;
const LONG_BAR = 9;

describe('accentLedLayout', () => {
  it('draws a short bar on one row', () => {
    expect(accentLedLayout(BEATS_IN_FOUR).flat(2)).toEqual([0, 1, 2, 3]);
    expect(accentLedLayout(BEATS_IN_FOUR)).toHaveLength(1);
  });

  it('wraps a long bar without passing the row limit', () => {
    const rows = accentLedLayout(LONG_BAR);
    expect(rows.flat(2)).toEqual(Array.from({ length: LONG_BAR }, (_, i) => i));
    for (const row of rows)
      expect(row.flat().length).toBeLessThanOrEqual(SHEET_LEDS_PER_ROW);
  });
});

describe('accentLedState', () => {
  it('maps each engine accent to its LED', () => {
    expect(accentLedState(KB_ACCENT.KB_ACCENT_ACCENTED)).toBe('accented');
    expect(accentLedState(KB_ACCENT.KB_ACCENT_NORMAL)).toBe('normal');
    expect(accentLedState(KB_ACCENT.KB_ACCENT_MUTED)).toBe('muted');
  });

  it('says the beat and its state', () => {
    expect(accentLedLabel(0, 'muted')).toBe('Beat 1, muted');
  });
});
