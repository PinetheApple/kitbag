import { asPercent, type Percent } from './percent.ts';

export type BarHeight = Percent;

export function waveBarHeights(
  envelope: readonly number[] | null,
  bars: number,
  minFraction: number,
): BarHeight[] {
  return Array.from({ length: bars }, (_, i) => {
    const value =
      envelope === null || envelope.length === 0
        ? 0
        : (envelope[Math.floor((i * envelope.length) / bars)] ?? 0);
    const fraction = Math.min(1, Math.max(minFraction, value));
    return asPercent(fraction);
  });
}
