import type { BpmBounds } from './bpmBounds.ts';

export const SWIPE_ACTIVATE_DP = 8;

export const SWIPE_CANCEL_X_DP = 20;

export const FINE_DP_PER_BPM = 14;

export const FINE_SPEED_DP_PER_S = 250;

export const FULL_SPEED_DP_PER_S = 1500;

export const MAX_SPEED_GAIN = 8;

export function clampBpm(bpm: number, bounds: BpmBounds): number {
  'worklet';
  if (bpm < bounds.min) return bounds.min;
  if (bpm > bounds.max) return bounds.max;
  return bpm;
}

export function speedGain(velocityY: number): number {
  'worklet';
  const reach =
    (Math.abs(velocityY) - FINE_SPEED_DP_PER_S) /
    (FULL_SPEED_DP_PER_S - FINE_SPEED_DP_PER_S);
  const clamped = reach < 0 ? 0 : reach > 1 ? 1 : reach;
  return 1 + (MAX_SPEED_GAIN - 1) * clamped * clamped;
}

export interface SwipeTempo {
  readonly bpm: number;
  readonly residue: number;
  readonly translationY: number;
}

export function startSwipe(bpm: number): SwipeTempo {
  'worklet';
  return { bpm, residue: 0, translationY: 0 };
}

// Residue is travel not yet spent on a whole BPM. A reversal or a bound drops
// it, so the tempo answers the new direction within one step of travel.
export function swipeTempo(
  swipe: SwipeTempo,
  translationY: number,
  velocityY: number,
  bounds: BpmBounds,
): SwipeTempo {
  'worklet';
  const travelled = swipe.translationY - translationY;
  if (travelled === 0) return swipe;
  const carried = travelled * swipe.residue < 0 ? 0 : swipe.residue;
  const residue = carried + travelled * speedGain(velocityY);
  const steps = Math.trunc(residue / FINE_DP_PER_BPM);
  const raw = swipe.bpm + steps;
  const bpm = clampBpm(raw, bounds);
  return {
    bpm,
    residue: raw === bpm ? residue - steps * FINE_DP_PER_BPM : 0,
    translationY,
  };
}
