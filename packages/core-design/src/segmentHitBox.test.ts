import { describe, expect, it } from 'vitest';

import { space } from './roles.ts';
import {
  OPTION_HEIGHTS,
  segmentHitBox,
  wrappedRowGap,
  type SegmentedControlSize,
} from './segmentHitBox.ts';
import { minTouchTargetDp } from './tokens.ts';

const SIZES = Object.keys(OPTION_HEIGHTS) as SegmentedControlSize[];
const PRACTICE_NEIGHBOURS = {
  top: space.controlGap,
  bottom: space.controlGap,
};
const ROW_TOPS = [0, 40, 80];

function targetAt(
  controlSize: SegmentedControlSize,
  lineTop: number | undefined,
  lineTops: readonly number[],
): number {
  const box = segmentHitBox({
    controlSize,
    compact: false,
    outer: PRACTICE_NEIGHBOURS,
    wrapped: { lineTop, lineTops },
  });
  return OPTION_HEIGHTS[controlSize] + box.paddingTop + box.paddingBottom;
}

function gapBeside(
  lineTop: number | undefined,
  outerRowTop: number | undefined,
  rowGap: number,
): number {
  if (lineTop === undefined) return Math.min(rowGap, space.controlGap);
  return lineTop === outerRowTop ? space.controlGap : rowGap;
}

describe('segmentHitBox once options wrap', () => {
  it('reaches the minimum target on a row between two others', () => {
    for (const controlSize of SIZES) {
      expect(
        targetAt(controlSize, ROW_TOPS[1], ROW_TOPS),
      ).toBeGreaterThanOrEqual(minTouchTargetDp);
    }
  });

  it('reaches the minimum target on the first and last rows of a large track', () => {
    expect(targetAt('large', ROW_TOPS[0], ROW_TOPS)).toBeGreaterThanOrEqual(
      minTouchTargetDp,
    );
    expect(targetAt('large', ROW_TOPS[2], ROW_TOPS)).toBeGreaterThanOrEqual(
      minTouchTargetDp,
    );
  });

  it('reaches the minimum target on a single measured row of a large track', () => {
    expect(targetAt('large', 0, [0])).toBeGreaterThanOrEqual(minTouchTargetDp);
  });

  it('reaches at most half of each gap, so neighbours never overlap', () => {
    const rows: readonly (number | undefined)[] = [...ROW_TOPS, undefined];
    for (const controlSize of SIZES) {
      const rowGap = wrappedRowGap(controlSize);
      for (const lineTop of rows) {
        const box = segmentHitBox({
          controlSize,
          compact: true,
          outer: PRACTICE_NEIGHBOURS,
          wrapped: { lineTop, lineTops: ROW_TOPS },
        });
        expect(box.paddingTop).toBeLessThanOrEqual(
          gapBeside(lineTop, ROW_TOPS[0], rowGap) / 2,
        );
        expect(box.paddingBottom).toBeLessThanOrEqual(
          gapBeside(lineTop, ROW_TOPS[2], rowGap) / 2,
        );
      }
    }
  });
});
