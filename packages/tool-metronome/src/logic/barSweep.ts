import { clampUnit } from '@kitbag/core-design';

const EMPTY = 0;

// Reduced motion drops the anticipation sweep (SPEC §12.3); the beat dots'
// on-beat colour swap still carries the beat.
export function sweepFill(barPhase: number, reduceMotion: boolean): number {
  'worklet';
  return reduceMotion ? EMPTY : clampUnit(barPhase);
}
