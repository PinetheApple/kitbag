import { clampUnit } from '@kitbag/core-design';
import type { KB_RAMP_UNIT } from '@kitbag/core-native';

import { rampRemainingTicks, rampTicksPerUnit } from './statusRows.ts';

const FULL = 1;
const SINGLE_TICK = 1;

// Under reduce motion the fill is derived from the countdown's own ticks, so the
// bar moves only when the text beside it changes.
export function rampProgressFill(
  progress: number,
  remaining: number,
  interval: number,
  unit: KB_RAMP_UNIT,
  reduceMotion: boolean,
): number {
  'worklet';
  if (!reduceMotion) return clampUnit(progress);
  const ticks = interval * rampTicksPerUnit(unit);
  return clampUnit(FULL - rampRemainingTicks(remaining, unit) / ticks);
}

// The engine applies a one-tick step on the click that would fill it, so a
// stepped bar would sit empty forever.
export function rampTrackShown(
  interval: number,
  unit: KB_RAMP_UNIT,
  reduceMotion: boolean,
): boolean {
  'worklet';
  return !reduceMotion || interval * rampTicksPerUnit(unit) > SINGLE_TICK;
}
