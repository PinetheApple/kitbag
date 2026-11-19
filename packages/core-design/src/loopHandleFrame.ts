import { sliderGeometry, stemPlayer } from './stemPlayerRoles.ts';
import { minTouchTargetDp } from './tokens.ts';

export type ScrubEdge = 'start' | 'end';

export interface LaneSize {
  readonly width: number;
  readonly height: number;
}

export interface BarBox extends LaneSize {
  readonly x: number;
  readonly y: number;
}

export interface HandleFrame {
  readonly shown: boolean;
  readonly left: number;
  readonly top: number;
  readonly height: number;
  readonly flagLeft: number;
  readonly flagTop: number;
}

export const LOOP_FLAG_TOP = stemPlayer.loopTintInset + stemPlayer.loopFlagTop;

const FLAG_WIDTH = stemPlayer.loopFlagWidth;
const FLAG_MIDDLE_X = stemPlayer.loopFlagWidth / 2;
const FLAG_MIDDLE_Y = stemPlayer.loopFlagHeight / 2;
const SEEK_TRACK = sliderGeometry.seek.track;
const HIT = minTouchTargetDp;
const HIT_MIDDLE = minTouchTargetDp / 2;

// A's flag hangs left of its line and B's right of its own, so a short loop
// never hides one flag under the other.
export function flagHang(edge: ScrubEdge): number {
  'worklet';
  return edge === 'start' ? FLAG_WIDTH : 0;
}

export function seekTrackTop(bar: BarBox): number {
  'worklet';
  return bar.y + (bar.height - SEEK_TRACK) / 2;
}

function clampInto(value: number, room: number): number {
  'worklet';
  return Math.min(Math.max(value, 0), room);
}

// Android only dispatches a touch inside every ancestor's bounds, so the box is
// clamped into the lane, and it stops above the track to leave seeking free.
export function loopHandleFrame(
  edge: ScrubEdge,
  at: number,
  bar: BarBox,
  lane: LaneSize,
): HandleFrame {
  'worklet';
  if (lane.width <= 0 || bar.width <= 0)
    return {
      shown: false,
      left: 0,
      top: 0,
      height: 0,
      flagLeft: 0,
      flagTop: 0,
    };
  const flagX = bar.x + at * bar.width - flagHang(edge);
  const flagY = bar.y + LOOP_FLAG_TOP;
  const left = clampInto(flagX + FLAG_MIDDLE_X - HIT_MIDDLE, lane.width - HIT);
  const top = clampInto(flagY + FLAG_MIDDLE_Y - HIT_MIDDLE, lane.height - HIT);
  return {
    shown: true,
    left,
    top,
    height: Math.min(HIT, seekTrackTop(bar) - top),
    flagLeft: flagX - left,
    flagTop: flagY - top,
  };
}
