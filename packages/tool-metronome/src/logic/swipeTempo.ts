import type { BpmBounds } from './bpmBounds.ts';

export const DP_PER_BPM = 8;

const FLING_TRAVEL_MS = 140;
const MS_PER_SECOND = 1000;
const FLING_MAX_BPM = 40;

export function clampBpm(bpm: number, bounds: BpmBounds): number {
  'worklet';
  if (bpm < bounds.min) return bounds.min;
  if (bpm > bounds.max) return bounds.max;
  return bpm;
}

export function dragBpmDelta(translationY: number): number {
  'worklet';
  const steps = Math.trunc(-translationY / DP_PER_BPM);
  // Math.trunc yields -0 for a sub-step downward drag.
  return steps === 0 ? 0 : steps;
}

export interface DragTempo {
  readonly bpm: number;
  readonly anchorBpm: number;
}

// Re-anchoring past a bound removes dead travel when the drag reverses.
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

export function flingBpmDelta(velocityY: number): number {
  'worklet';
  const travel = (velocityY * FLING_TRAVEL_MS) / MS_PER_SECOND;
  const delta = dragBpmDelta(travel);
  if (delta > FLING_MAX_BPM) return FLING_MAX_BPM;
  if (delta < -FLING_MAX_BPM) return -FLING_MAX_BPM;
  return delta;
}
