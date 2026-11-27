import { describe, expect, it } from 'vitest';

import { beatDotSize, MAX_DOTS_PER_LINE } from '@kitbag/core-design';
import { layoutBeatLeds } from '@kitbag/core-state';

const sizesOf = (rows: readonly (readonly (readonly number[])[])[]) =>
  rows.map((row) => row.map((group) => group.length));

describe('layoutBeatLeds', () => {
  it('lays 12/8 out as the mockup frame draws it', () => {
    expect(sizesOf(layoutBeatLeds(12, MAX_DOTS_PER_LINE))).toEqual([
      [3, 3],
      [3, 3],
    ]);
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
