import { KB_MAX_GRID_BEATS } from '@kitbag/core-native';

import { lastValueAtOrBefore, NOT_FOUND } from './search.ts';

export function nearestBeat(
  beats: readonly number[],
  seconds: number,
): number | null {
  if (beats.length === 0) return null;
  const before = lastValueAtOrBefore(beats, seconds);
  const after = before + 1;
  if (before === NOT_FOUND) return after;
  if (after === beats.length) return before;
  const gapBefore = seconds - (beats[before] ?? seconds);
  const gapAfter = (beats[after] ?? seconds) - seconds;
  return gapBefore <= gapAfter ? before : after;
}

export function snapToBeat(seconds: number, beats: readonly number[]): number {
  const index = nearestBeat(beats, seconds);
  return index === null ? seconds : (beats[index] ?? seconds);
}

export interface LoopSeconds {
  readonly startSec: number;
  readonly endSec: number;
}

// A loop is never empty while the grid has room after its start.
export function loopBetween(
  a: number,
  b: number,
  beats: readonly number[],
): LoopSeconds | null {
  const first = snapToBeat(Math.min(a, b), beats);
  let end = snapToBeat(Math.max(a, b), beats);
  if (end <= first) end = beats.find((beat) => beat > first) ?? end;
  return end > first ? { startSec: first, endSec: end } : null;
}

// Long songs keep their early beats, as the analyser does (SPEC §4.3.1); the
// click then falls silent past the last one (§4.2).
export function clickGrid(beats: readonly number[]): readonly number[] {
  return beats.length > KB_MAX_GRID_BEATS
    ? beats.slice(0, KB_MAX_GRID_BEATS)
    : beats;
}
