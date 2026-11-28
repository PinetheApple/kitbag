import { MS_PER_MINUTE } from '@kitbag/core-db';

import type { BpmBounds } from '../metronome/config.ts';

// A finger keeping the slowest legal tempo will not land every interval
// exactly, and a series must survive that wobble.
const TIMEOUT_SLACK = 1.5;

export const TAP_WINDOW_INTERVALS = 4;
export const TAPS_TO_SET_TEMPO = 4;

const MIN_TAPS_FOR_TEMPO = 2;

// Derived from the slowest legal tempo: a fixed 2 s would sit at 30 BPM and put
// every tempo under it out of reach.
export function tapTimeoutMs(bounds: BpmBounds): number {
  return (MS_PER_MINUTE / bounds.min) * TIMEOUT_SLACK;
}

export function pushTap(
  taps: readonly number[],
  nowMs: number,
  bounds: BpmBounds,
  windowIntervals = TAP_WINDOW_INTERVALS,
): readonly number[] {
  const last = taps.at(-1);
  if (last === undefined || nowMs - last > tapTimeoutMs(bounds)) return [nowMs];
  return [...taps, nowMs].slice(-(windowIntervals + 1));
}

// Averages intervals, not BPMs: the mean of reciprocals biases high. Unclamped,
// since the caller owns the range.
export function tapIntervalBpm(taps: readonly number[]): number | undefined {
  if (taps.length < MIN_TAPS_FOR_TEMPO) return undefined;
  const first = taps[0];
  const last = taps.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const span = last - first;
  if (span <= 0) return undefined;
  const meanInterval = span / (taps.length - 1);
  return MS_PER_MINUTE / meanInterval;
}

export function tapTempoBpm(taps: readonly number[]): number | undefined {
  const bpm = tapIntervalBpm(taps);
  return bpm === undefined ? undefined : Math.round(bpm);
}
