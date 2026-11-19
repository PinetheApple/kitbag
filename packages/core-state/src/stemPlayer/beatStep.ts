export type BeatDirection = 1 | -1;

// Absorbs an edge that frame rounding left a hair off its beat.
const BEAT_EPSILON_SECONDS = 0.001;

export function beatBeside(
  seconds: number,
  beats: readonly number[],
  direction: BeatDirection,
): number | null {
  if (direction > 0)
    return beats.find((beat) => beat > seconds + BEAT_EPSILON_SECONDS) ?? null;
  return (
    beats.findLast((beat) => beat < seconds - BEAT_EPSILON_SECONDS) ?? null
  );
}
