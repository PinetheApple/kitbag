import { stemPlayer } from './stemPlayerRoles.ts';
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
  readonly left: number;
  readonly top: number;
  readonly flagLeft: number;
  readonly flagTop: number;
}

const FLAG_WIDTH = stemPlayer.loopFlagWidth;
const FLAG_TOP = stemPlayer.loopTintInset + stemPlayer.loopFlagTop;
const FLAG_MIDDLE_X = stemPlayer.loopFlagWidth / 2;
const FLAG_MIDDLE_Y = stemPlayer.loopFlagHeight / 2;
const HIT = minTouchTargetDp;
const HIT_MIDDLE = minTouchTargetDp / 2;

function clampInto(value: number, room: number): number {
  'worklet';
  return Math.min(Math.max(value, 0), room);
}

// Android only dispatches a touch inside every ancestor's bounds, so the hit
// box is clamped into the lane while the flag keeps its drawn place.
export function loopHandleFrame(
  edge: ScrubEdge,
  at: number,
  bar: BarBox,
  lane: LaneSize,
): HandleFrame {
  'worklet';
  const flagX = bar.x + at * bar.width - (edge === 'start' ? FLAG_WIDTH : 0);
  const flagY = bar.y + FLAG_TOP;
  const left = clampInto(flagX + FLAG_MIDDLE_X - HIT_MIDDLE, lane.width - HIT);
  const top = clampInto(flagY + FLAG_MIDDLE_Y - HIT_MIDDLE, lane.height - HIT);
  return { left, top, flagLeft: flagX - left, flagTop: flagY - top };
}
