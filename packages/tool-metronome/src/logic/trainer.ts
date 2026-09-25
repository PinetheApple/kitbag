export const MUTE_PREVIEW_BARS = 8;
const MIN_BARS = 1;

export interface BarBounds {
  readonly min: number;
  readonly max: number;
}

export function barBounds(max: number): BarBounds {
  return { min: MIN_BARS, max };
}

export function stepWithin(
  value: number,
  delta: number,
  bounds: BarBounds,
): number {
  return Math.min(Math.max(value + delta, bounds.min), bounds.max);
}

export function rampChipValue(startBpm: number, endBpm: number): string {
  return `${String(startBpm)}→${String(endBpm)}`;
}

export function muteChipValue(playBars: number, muteBars: number): string {
  return `${String(playBars)} play · ${String(muteBars)} mute`;
}

export function mutePreview(
  playBars: number,
  muteBars: number,
  bars: number = MUTE_PREVIEW_BARS,
): readonly boolean[] {
  const cycle = playBars + muteBars;
  return Array.from({ length: bars }, (_unused, bar) => bar % cycle < playBars);
}
