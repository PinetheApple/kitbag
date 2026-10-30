import { clampUnit } from '@kitbag/core-design';

import type { BpmBounds } from './bpmBounds.ts';

export const SWIPE_ACTIVATE_DP = 8;

export const SWIPE_CANCEL_X_DP = 20;

export const FINE_DP_PER_BPM = 14;

export const FINE_SPEED_DP_PER_S = 250;

export const FULL_SPEED_DP_PER_S = 1500;

export const MAX_SPEED_GAIN = 8;

export const REVERSAL_DP = 3;

export function clampBpm(bpm: number, bounds: BpmBounds): number {
  'worklet';
  if (bpm < bounds.min) return bounds.min;
  if (bpm > bounds.max) return bounds.max;
  return bpm;
}

export function speedGain(velocityY: number): number {
  'worklet';
  const reach = clampUnit(
    (Math.abs(velocityY) - FINE_SPEED_DP_PER_S) /
      (FULL_SPEED_DP_PER_S - FINE_SPEED_DP_PER_S),
  );
  return 1 + (MAX_SPEED_GAIN - 1) * reach * reach;
}

export interface SwipeTempo {
  readonly bpm: number;
  readonly residue: number;
  readonly backtrack: number;
  readonly translationY: number;
}

export function startSwipe(bpm: number): SwipeTempo {
  'worklet';
  return { bpm, residue: 0, backtrack: 0, translationY: 0 };
}

// Residue is travel not yet spent on a whole BPM. Moving back past
// REVERSAL_DP drops it, so a reversal answers within one step but tremor does not.
export function swipeTempo(
  swipe: SwipeTempo,
  translationY: number,
  velocityY: number,
  bounds: BpmBounds,
): SwipeTempo {
  'worklet';
  const travelled = swipe.translationY - translationY;
  if (travelled === 0) return swipe;
  const against = travelled * swipe.residue < 0;
  const backtrack = against ? swipe.backtrack + Math.abs(travelled) : 0;
  const reversed = backtrack >= REVERSAL_DP;
  const residue = reversed
    ? Math.sign(travelled) * backtrack
    : swipe.residue + travelled * speedGain(velocityY);
  const steps = Math.trunc(residue / FINE_DP_PER_BPM);
  const raw = swipe.bpm + steps;
  const bpm = clampBpm(raw, bounds);
  return {
    bpm,
    residue: raw === bpm ? residue - steps * FINE_DP_PER_BPM : 0,
    backtrack: reversed ? 0 : backtrack,
    translationY,
  };
}
