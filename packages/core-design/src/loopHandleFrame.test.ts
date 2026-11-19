import { describe, expect, it } from 'vitest';

import {
  flagHang,
  LOOP_FLAG_TOP,
  loopHandleFrame,
  seekTrackTop,
  type BarBox,
  type LaneSize,
  type ScrubEdge,
} from './loopHandleFrame.ts';
import { sliderGeometry, stemPlayer } from './stemPlayerRoles.ts';
import { minTouchTargetDp } from './tokens.ts';

const LANE_WIDTHS = [minTouchTargetDp * 2, 360];
const ELAPSED_WIDTHS = [0, 40];
const LANE_TOPS = [stemPlayer.laneTop, stemPlayer.laneTop * 2];
const EDGES: readonly ScrubEdge[] = ['start', 'end'];
const AT = [0, 0.5, 1];
const UNMEASURED_LANE: LaneSize = { width: 0, height: 0 };
const UNMEASURED_BAR: BarBox = { x: 0, y: 0, width: 0, height: 0 };

function laneAndBar(laneWidth: number, elapsed: number, laneTop: number) {
  const lane: LaneSize = {
    width: laneWidth,
    height: Math.max(stemPlayer.laneHeight, laneTop + minTouchTargetDp),
  };
  const x = elapsed + stemPlayer.laneGap + sliderGeometry.seek.thumb / 2;
  const bar: BarBox = {
    x,
    y: laneTop + (lane.height - laneTop - minTouchTargetDp) / 2,
    width: Math.max(0, laneWidth - 2 * x),
    height: minTouchTargetDp,
  };
  return { lane, bar };
}

const CASES = LANE_WIDTHS.flatMap((width) =>
  ELAPSED_WIDTHS.flatMap((elapsed) =>
    LANE_TOPS.flatMap((laneTop) =>
      EDGES.flatMap((edge) =>
        AT.map((at) => ({
          ...laneAndBar(width, elapsed, laneTop),
          width,
          elapsed,
          laneTop,
          edge,
          at,
        })),
      ),
    ),
  ),
).filter(({ bar }) => bar.width > 0);
const TITLE = '$edge at $at, lane $width wide, top $laneTop, elapsed $elapsed';

describe('the loop handle hit box', () => {
  it.each(CASES)(
    `sits inside the lane (${TITLE})`,
    ({ lane, bar, edge, at }) => {
      const frame = loopHandleFrame(edge, at, bar, lane);
      expect(frame.left).toBeGreaterThanOrEqual(0);
      expect(frame.top).toBeGreaterThanOrEqual(0);
      expect(frame.left + minTouchTargetDp).toBeLessThanOrEqual(lane.width);
      expect(frame.top + frame.height).toBeLessThanOrEqual(lane.height);
    },
  );

  it.each(CASES)(
    `stays above the seek track (${TITLE})`,
    ({ lane, bar, edge, at }) => {
      const frame = loopHandleFrame(edge, at, bar, lane);
      const trackTop = bar.y + (bar.height - sliderGeometry.seek.track) / 2;
      expect(seekTrackTop(bar)).toBe(trackTop);
      expect(frame.top + frame.height).toBeLessThanOrEqual(trackTop);
      expect(frame.height).toBeGreaterThan(0);
    },
  );

  it.each(CASES)(
    `keeps the flag where the static flag draws it (${TITLE})`,
    ({ lane, bar, edge, at }) => {
      const frame = loopHandleFrame(edge, at, bar, lane);
      expect(frame.left + frame.flagLeft).toBeCloseTo(
        bar.x + at * bar.width - flagHang(edge),
      );
      expect(frame.top + frame.flagTop).toBeCloseTo(bar.y + LOOP_FLAG_TOP);
    },
  );

  it('hides the handle until the lane is measured', () => {
    const frame = loopHandleFrame('start', 0, UNMEASURED_BAR, UNMEASURED_LANE);
    expect(frame.shown).toBe(false);
    expect(frame.height).toBe(0);
  });
});
