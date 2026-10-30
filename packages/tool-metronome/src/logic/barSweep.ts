const EMPTY = 0;
const FULL = 1;

// Reduced motion drops the anticipation sweep (SPEC §12.3); the beat dots'
// on-beat colour swap still carries the beat.
export function sweepFill(barPhase: number, reduceMotion: boolean): number {
  'worklet';
  if (reduceMotion) return EMPTY;
  return Math.min(FULL, Math.max(EMPTY, barPhase));
}
