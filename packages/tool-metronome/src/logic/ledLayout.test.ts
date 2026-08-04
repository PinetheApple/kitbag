import { describe, expect, it } from 'vitest';

import {
  beatGroupSizes,
  layoutBeatLeds,
  MAX_LEDS_PER_ROW,
  MIN_LEDS_PER_ROW,
} from './ledLayout.ts';

// The engine's own ceiling on beats per bar is KB_MAX_BEATS (16); the layout is
// only ever asked for bars inside it.
const MAX_BEATS = 16;

const sizesOf = (rows: readonly (readonly (readonly number[])[])[]) =>
  rows.map((row) => row.map((group) => group.length));

const ledsPerRow = (rows: readonly (readonly (readonly number[])[])[]) =>
  rows.map((row) => row.reduce((n, group) => n + group.length, 0));

describe('beatGroupSizes', () => {
  it('groups 7 as 2+2+3, the grouping the circle could never show (D9)', () => {
    expect(beatGroupSizes(7)).toEqual([2, 2, 3]);
  });

  it('chunks a regular bar by four', () => {
    expect(beatGroupSizes(4)).toEqual([4]);
    expect(beatGroupSizes(8)).toEqual([4, 4]);
    expect(beatGroupSizes(16)).toEqual([4, 4, 4, 4]);
  });

  it('trails the remainder of an unlisted count', () => {
    expect(beatGroupSizes(13)).toEqual([4, 4, 4, 1]);
  });

  it('has no groups for an empty bar', () => {
    expect(beatGroupSizes(0)).toEqual([]);
  });
});

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
