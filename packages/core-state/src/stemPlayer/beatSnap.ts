export function snapToBeat(seconds: number, beats: readonly number[]): number {
  let nearest = seconds;
  let distance = Infinity;
  for (const beat of beats) {
    const gap = Math.abs(beat - seconds);
    if (gap < distance) {
      nearest = beat;
      distance = gap;
    }
  }
  return nearest;
}

export type BeatDirection = 1 | -1;

export function beatBeside(
  seconds: number,
  beats: readonly number[],
  direction: BeatDirection,
): number | null {
  const index = beats.indexOf(snapToBeat(seconds, beats));
  if (index < 0) return null;
  return beats[index + direction] ?? null;
}
