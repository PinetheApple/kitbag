import { KB_ACCENT, KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  layoutBeatLeds,
  ledStateFor,
  ledStatesFor,
  MAX_LEDS_PER_ROW,
  MIN_LEDS_PER_ROW,
} from './ledLayout.ts';

const MAX_BEATS = KB_MAX_BEATS;

const sizesOf = (rows: readonly (readonly (readonly number[])[])[]) =>
  rows.map((row) => row.map((group) => group.length));

const ledsPerRow = (rows: readonly (readonly (readonly number[])[])[]) =>
  rows.map((row) => row.reduce((n, group) => n + group.length, 0));

describe('layoutBeatLeds', () => {
  it('lays 16 beats out as four rows of four (SPEC §5.2)', () => {
    expect(sizesOf(layoutBeatLeds(16))).toEqual([[4], [4], [4], [4]]);
  });

  it('keeps 7 beats on one row, grouped (design §02 draws 7/8 as 2+2+3)', () => {
    expect(sizesOf(layoutBeatLeds(7))).toEqual([[2, 2, 3]]);
  });

  it('numbers beats consecutively across groups and rows', () => {
    expect(layoutBeatLeds(7)).toEqual([
      [
        [0, 1],
        [2, 3],
        [4, 5, 6],
      ],
    ]);
    expect(layoutBeatLeds(8)).toEqual([[[0, 1, 2, 3]], [[4, 5, 6, 7]]]);
    expect(layoutBeatLeds(4)).toEqual([[[0, 1, 2, 3]]]);
  });

  it('holds every row but the last at or above the minimum', () => {
    for (let beats = 1; beats <= MAX_BEATS; beats++) {
      const rows = ledsPerRow(layoutBeatLeds(beats));
      for (const leds of rows.slice(0, -1)) {
        expect(leds).toBeGreaterThanOrEqual(MIN_LEDS_PER_ROW);
      }
    }
  });

  // The last row takes the remainder, so it is the one place the minimum can
  // give. Pinned exhaustively rather than exempted: a grouping change that makes
  // a second bar count end short has to come and edit this list.
  it('ends short on exactly one bar length across the range', () => {
    const short: number[] = [];
    for (let beats = 1; beats <= MAX_BEATS; beats++) {
      const rows = ledsPerRow(layoutBeatLeds(beats));
      const last = rows.at(-1) ?? 0;
      if (rows.length > 1 && last < MIN_LEDS_PER_ROW) short.push(beats);
    }
    expect(short).toEqual([9]);
    expect(ledsPerRow(layoutBeatLeds(9))).toEqual([6, 3]);
  });

  it('never exceeds the per-row ceiling once a row has wrapped', () => {
    for (let beats = 1; beats <= MAX_BEATS; beats++) {
      for (const leds of ledsPerRow(layoutBeatLeds(beats))) {
        expect(leds).toBeLessThanOrEqual(MAX_LEDS_PER_ROW);
      }
    }
  });

  it('keeps every beat exactly once', () => {
    for (let beats = 1; beats <= MAX_BEATS; beats++) {
      const flat = layoutBeatLeds(beats).flat(2);
      expect(flat).toEqual(Array.from({ length: beats }, (_u, i) => i));
    }
  });
});

describe('ledStateFor', () => {
  it('maps each engine accent to its LED', () => {
    expect(ledStateFor(KB_ACCENT.KB_ACCENT_ACCENTED)).toBe('accented');
    expect(ledStateFor(KB_ACCENT.KB_ACCENT_NORMAL)).toBe('normal');
    expect(ledStateFor(KB_ACCENT.KB_ACCENT_MUTED)).toBe('muted');
  });
});

describe('ledStatesFor', () => {
  it('gives every beat of the bar a state, normal where no accent is set', () => {
    expect(ledStatesFor([KB_ACCENT.KB_ACCENT_ACCENTED], 3)).toEqual([
      'accented',
      'normal',
      'normal',
    ]);
  });

  it('drops accents past the bar', () => {
    expect(
      ledStatesFor([KB_ACCENT.KB_ACCENT_NORMAL, KB_ACCENT.KB_ACCENT_MUTED], 1),
    ).toEqual(['normal']);
  });
});
