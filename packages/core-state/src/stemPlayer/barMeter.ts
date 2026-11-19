import type { StemPlayerState } from './store.ts';

// The analyser's bar length, for a grid with no bar marks.
export const FALLBACK_BEATS_PER_BAR = 4;

export type BarMeterSong = Pick<StemPlayerState, 'beats' | 'downbeatIndices'>;

export const barMeter: (song: BarMeterSong) => number = () =>
  FALLBACK_BEATS_PER_BAR;

export function impliedMeter(downbeatIndices: readonly number[]): number {
  const counts = new Map<number, number>();
  let meter = FALLBACK_BEATS_PER_BAR;
  let most = 0;
  downbeatIndices.forEach((beat, i) => {
    const gap = beat - (downbeatIndices[i - 1] ?? beat);
    if (!Number.isInteger(gap) || gap <= 0) return;
    const seen = (counts.get(gap) ?? 0) + 1;
    counts.set(gap, seen);
    if (seen > most || (seen === most && gap > meter)) {
      most = seen;
      meter = gap;
    }
  });
  return meter;
}
