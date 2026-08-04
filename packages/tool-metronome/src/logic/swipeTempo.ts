// Swipe-anywhere tempo (SPEC §5.2): the whole screen is the tempo control —
// vertical drag ±1 BPM per ~8dp, fling for coarse jumps. Pure and 'worklet'-safe
// so the gesture thread can call it and a test can assert the mapping without a
// gesture, a screen or a device.

import type { BpmBounds } from './bpmBounds.ts';

/** SPEC §5.2: "±1 BPM per ~8dp". */
export const DP_PER_BPM = 8;

// SPEC says "fling for coarse jumps" and fixes no number, so the fling is
// modelled as the drag the release velocity would have produced had it run on
// for FLING_TRAVEL_MS, capped so a hard flick cannot cross the whole BPM range
// in one gesture. Both constants are ours, not SPEC's.
const FLING_TRAVEL_MS = 140;
const MS_PER_SECOND = 1000;
const FLING_MAX_BPM = 40;

/** Screen-space Y (RN: +Y is down) -> BPM offset. Up is faster. */
export function dragBpmDelta(translationY: number): number {
  'worklet';
  const steps = Math.trunc(-translationY / DP_PER_BPM);
  // Math.trunc gives -0 for a sub-step downward drag; normalise so a held
  // tempo is one value, not two.
  return steps === 0 ? 0 : steps;
}

export interface DragTempo {
  /** The tempo to apply now. */
  readonly bpm: number;
  /** The anchor the NEXT sample of this same drag must be measured from. */
  readonly anchorBpm: number;
}

/**
 * One sample of a drag: the tempo it reaches, and the anchor to carry forward.
 *
 * Clamping the result alone is not enough. With a fixed anchor, a drag that
 * pushes 25 BPM past the ceiling has to be pulled 25 BPM back before anything
 * moves — dead travel under the finger. So when the raw value leaves the range
 * the anchor is re-cut against the travel so far, and reversing the drag moves
 * the tempo on the next step.
 */
export function dragTempo(
  anchorBpm: number,
  translationY: number,
  bounds: BpmBounds,
): DragTempo {
  'worklet';
  const travelled = dragBpmDelta(translationY);
  const raw = anchorBpm + travelled;
  const bpm = clampBpm(raw, bounds);
  if (raw === bpm) return { bpm, anchorBpm };
  return { bpm, anchorBpm: bpm - travelled };
}

export function clampBpm(bpm: number, bounds: BpmBounds): number {
  'worklet';
  if (bpm < bounds.min) return bounds.min;
  if (bpm > bounds.max) return bounds.max;
  return bpm;
}

/** Release velocity (dp/s, +Y down) -> the coarse BPM jump it throws. */
export function flingBpmDelta(velocityY: number): number {
  'worklet';
  const travel = (velocityY * FLING_TRAVEL_MS) / MS_PER_SECOND;
  const delta = dragBpmDelta(travel);
  if (delta > FLING_MAX_BPM) return FLING_MAX_BPM;
  if (delta < -FLING_MAX_BPM) return -FLING_MAX_BPM;
  return delta;
}
