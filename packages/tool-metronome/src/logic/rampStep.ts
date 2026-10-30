export type RampDirection = 'up' | 'down' | 'flat';

const MINUS = '−';

export function rampDirection(
  startBpm: number,
  targetBpm: number,
): RampDirection {
  if (targetBpm > startBpm) return 'up';
  return targetBpm < startBpm ? 'down' : 'flat';
}

export function rampStepText(
  stepBpm: number,
  startBpm: number,
  targetBpm: number,
): string {
  const direction = rampDirection(startBpm, targetBpm);
  const magnitude = String(Math.abs(stepBpm));
  if (direction === 'up') return `+${magnitude}`;
  return direction === 'down' ? `${MINUS}${magnitude}` : magnitude;
}

export function rampStepSpoken(
  stepBpm: number,
  startBpm: number,
  targetBpm: number,
): string {
  const direction = rampDirection(startBpm, targetBpm);
  const amount = `${String(Math.abs(stepBpm))} BPM`;
  return direction === 'flat' ? amount : `${amount} ${direction}`;
}
