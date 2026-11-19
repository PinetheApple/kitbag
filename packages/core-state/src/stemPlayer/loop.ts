import { KB_MAX_GRID_BEATS } from '@kitbag/core-native';

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

export type LoopEdge = 'start' | 'end';

export function movedEdge(
  loop: LoopSeconds,
  edge: LoopEdge,
  seconds: number,
  beats: readonly number[],
  durationSec: number,
): LoopSeconds | null {
  const target = Math.min(Math.max(seconds, 0), durationSec);
  if (edge === 'start') {
    if (target >= loop.endSec) return null;
    const side = beats.filter((beat) => beat < loop.endSec);
    return { startSec: snapToBeat(target, side), endSec: loop.endSec };
  }
  if (target <= loop.startSec) return null;
  const side = beats.filter((beat) => beat > loop.startSec);
  return { startSec: loop.startSec, endSec: snapToBeat(target, side) };
}

// Long songs keep their early beats, as the analyser does (SPEC §4.3.1); the
// click then falls silent past the last one (§4.2).
export function clickGrid(beats: readonly number[]): readonly number[] {
  return beats.length > KB_MAX_GRID_BEATS
    ? beats.slice(0, KB_MAX_GRID_BEATS)
    : beats;
}
