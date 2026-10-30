import { metronome, space } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  beatDotsHeight,
  belowTempoHeight,
  belowTempoReserve,
} from './belowTempo.ts';

const SMALL_PHONE_DOTS_WIDTH = 360 - space.screenInset * 2;
const LARGE_PHONE_DOTS_WIDTH = 411 - space.screenInset * 2;

const MINIMAL = { beatCount: 4, poly: false };
const BUSIEST = { beatCount: 12, poly: true };

const CASES = [
  { width: SMALL_PHONE_DOTS_WIDTH, gap: metronome.bodyGapCompact },
  { width: LARGE_PHONE_DOTS_WIDTH, gap: space.sectionGap },
] as const;

describe('belowTempoReserve', () => {
  it.each(CASES)(
    'is taller in the busiest state than the minimal one at $width dp',
    ({ width, gap }) => {
      expect(belowTempoHeight(BUSIEST, width, gap)).toBeGreaterThan(
        belowTempoHeight(MINIMAL, width, gap),
      );
    },
  );

  it.each(CASES)(
    'holds every meter, with and without poly, at $width dp',
    ({ width, gap }) => {
      const reserve = belowTempoReserve(width, gap);
      for (let beatCount = 1; beatCount <= KB_MAX_BEATS; beatCount += 1) {
        for (const poly of [false, true]) {
          expect(
            belowTempoHeight({ beatCount, poly }, width, gap),
          ).toBeLessThanOrEqual(reserve);
        }
      }
    },
  );

  it.each(CASES)(
    'is exactly the tallest meter, so nothing below the dots is wasted at $width dp',
    ({ width, gap }) => {
      const heights = Array.from({ length: KB_MAX_BEATS }, (_u, i) =>
        belowTempoHeight({ beatCount: i + 1, poly: true }, width, gap),
      );
      expect(belowTempoReserve(width, gap)).toBe(Math.max(...heights));
    },
  );
});

describe('beatDotsHeight', () => {
  it('adds the poly row below the beat lines', () => {
    const plain = beatDotsHeight(MINIMAL, SMALL_PHONE_DOTS_WIDTH);
    const poly = beatDotsHeight(
      { ...MINIMAL, poly: true },
      SMALL_PHONE_DOTS_WIDTH,
    );
    expect(poly - plain).toBe(metronome.beatDotLineGap + metronome.polyDot);
  });

  it('wraps twelve beats onto a second line', () => {
    const one = beatDotsHeight(MINIMAL, SMALL_PHONE_DOTS_WIDTH);
    const two = beatDotsHeight(
      { beatCount: 12, poly: false },
      SMALL_PHONE_DOTS_WIDTH,
    );
    expect(two).toBeGreaterThan(one);
  });
});
