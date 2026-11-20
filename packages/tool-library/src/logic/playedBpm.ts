export function playedBpm(bpm: number | null, speed: number): number | null {
  return bpm === null ? null : bpm * speed;
}
