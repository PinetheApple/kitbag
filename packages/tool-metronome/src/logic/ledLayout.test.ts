import { describe, expect, it } from 'vitest';

import {
  beatDotSize,
  layoutBeatLeds,
  MAX_DOTS_PER_LINE,
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

describe('layoutBeatLeds', () => {
  it('lays 12/8 out as the mockup frame draws it', () => {
    expect(sizesOf(layoutBeatLeds(12, MAX_DOTS_PER_LINE))).toEqual([
      [3, 3],
      [3, 3],
    ]);
  });

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

// The mockup's phone: 360 wide less two 16dp screen insets.
const MOCKUP_WIDTH = 328;
const MOCKUP_METRICS = { maxDot: 56, dotGap: 12, groupGap: 22 };

describe('beat dot lines', () => {
  const dots = (beats: number) =>
    sizesOf(layoutBeatLeds(beats, MAX_DOTS_PER_LINE));

  it('keeps up to eight beats on one line', () => {
    expect(dots(7)).toEqual([[2, 2, 3]]);
    expect(dots(8)).toEqual([[4, 4]]);
  });

  it('wraps past eight at a group boundary', () => {
    expect(dots(9)).toEqual([[3, 3], [3]]);
    expect(dots(12)).toEqual([
      [3, 3],
      [3, 3],
    ]);
    expect(dots(16)).toEqual([
      [4, 4],
      [4, 4],
    ]);
  });
});

describe('beatDotSize', () => {
  const sizeFor = (beats: number, width = MOCKUP_WIDTH) =>
    beatDotSize(
      layoutBeatLeds(beats, MAX_DOTS_PER_LINE),
      width,
      MOCKUP_METRICS,
    );

  it('caps at the largest dot when the line has room', () => {
    expect(sizeFor(3)).toBe(56);
    expect(sizeFor(4)).toBe(56);
  });

  it('matches the mockup frames for 7/8 and 12/8', () => {
    expect(sizeFor(7)).toBe(33);
    expect(sizeFor(12)).toBe(43);
  });

  it('sizes every line by the fullest one, so wrapped lines match', () => {
    expect(sizeFor(9)).toBe(sizeFor(6));
    expect(sizeFor(16)).toBe(29);
  });

  it('shrinks on a narrower screen and never goes negative', () => {
    expect(sizeFor(7, 288)).toBe(28);
    expect(sizeFor(7, 10)).toBe(0);
  });

  it('keeps the largest dot for an empty bar', () => {
    expect(beatDotSize([], MOCKUP_WIDTH, MOCKUP_METRICS)).toBe(56);
  });
});
