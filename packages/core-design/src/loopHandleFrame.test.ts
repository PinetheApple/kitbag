import { describe, expect, it } from 'vitest';

import {
  loopHandleFrame,
  type BarBox,
  type LaneSize,
  type ScrubEdge,
} from './loopHandleFrame.ts';
import { sliderGeometry, stemPlayer } from './stemPlayerRoles.ts';
import { minTouchTargetDp } from './tokens.ts';

const LANE_WIDTHS = [minTouchTargetDp * 2, 360];
const ELAPSED_WIDTHS = [0, 40];
const EDGES: readonly ScrubEdge[] = ['start', 'end'];
const AT = [0, 0.5, 1];

function laneAndBar(laneWidth: number, elapsed: number) {
  const lane: LaneSize = { width: laneWidth, height: stemPlayer.laneHeight };
  const x = elapsed + stemPlayer.laneGap + sliderGeometry.seek.thumb / 2;
  const content = lane.height - stemPlayer.laneTop;
  const bar: BarBox = {
    x,
    y: stemPlayer.laneTop + (content - minTouchTargetDp) / 2,
    width: Math.max(0, laneWidth - 2 * x),
    height: minTouchTargetDp,
  };
  return { lane, bar };
}

const CASES = LANE_WIDTHS.flatMap((width) =>
  ELAPSED_WIDTHS.flatMap((elapsed) =>
    EDGES.flatMap((edge) =>
      AT.map((at) => ({ ...laneAndBar(width, elapsed), edge, at })),
    ),
  ),
);

describe('the loop handle hit box', () => {
  it.each(CASES)(
    'sits inside the lane ($edge at $at, lane $lane.width)',
    ({ lane, bar, edge, at }) => {
      const frame = loopHandleFrame(edge, at, bar, lane);
      expect(frame.left).toBeGreaterThanOrEqual(0);
      expect(frame.top).toBeGreaterThanOrEqual(0);
      expect(frame.left + minTouchTargetDp).toBeLessThanOrEqual(lane.width);
      expect(frame.top + minTouchTargetDp).toBeLessThanOrEqual(lane.height);
    },
  );

  it.each(CASES)(
    'leaves the flag where the static flag draws it ($edge at $at)',
    ({ lane, bar, edge, at }) => {
      const frame = loopHandleFrame(edge, at, bar, lane);
      const hang = edge === 'start' ? stemPlayer.loopFlagWidth : 0;
      expect(frame.left + frame.flagLeft).toBeCloseTo(
        bar.x + at * bar.width - hang,
      );
      expect(frame.top + frame.flagTop).toBeCloseTo(
        bar.y + stemPlayer.loopTintInset + stemPlayer.loopFlagTop,
      );
    },
  );
});
