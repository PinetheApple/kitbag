import type { StemPlayerState } from './store.ts';

// The analyser's bar length, for a grid with no bar marks.
export const FALLBACK_BEATS_PER_BAR = 4;

export type BarMeterSong = Pick<StemPlayerState, 'beats' | 'downbeatIndices'>;

export const barMeter: (song: BarMeterSong) => number = () =>
  FALLBACK_BEATS_PER_BAR;

export function impliedMeter(downbeatIndices: readonly number[]): number {
  const [first, second] = downbeatIndices;
  if (first === undefined || second === undefined)
    return FALLBACK_BEATS_PER_BAR;
  const gap = second - first;
  return Number.isInteger(gap) && gap > 0 ? gap : FALLBACK_BEATS_PER_BAR;
}
