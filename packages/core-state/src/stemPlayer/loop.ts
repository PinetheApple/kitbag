import { KB_MAX_GRID_BEATS } from '@kitbag/core-native';

import { lastValueAtOrBefore, NOT_FOUND } from './search.ts';
import type { LoopFailure, LoopState } from './store.ts';

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

export function boundsOf({ startSec, endSec }: LoopSeconds): LoopSeconds {
  return { startSec, endSec };
}

export function loopHolds({ startSec, endSec }: LoopSeconds, seconds: number) {
  return seconds >= startSec && seconds < endSec;
}

export function refusedLoop(loop: LoopState, loopFailure: LoopFailure) {
  return {
    loop: loop.kind === 'on' ? loop : ({ kind: 'off' } as const),
    loopFailure,
  };
}

export type LoopEdge = 'start' | 'end';

export interface HeldStart {
  readonly startSec: number;
  readonly loop: LoopSeconds | null;
}

export function movedEdge(
  loop: LoopSeconds,
  edge: LoopEdge,
  seconds: number,
  beats: readonly number[],
  durationSec: number,
): LoopSeconds | null {
  const target = Math.min(Math.max(seconds, 0), durationSec);
  if (edge === 'start') {
    const side = beats.filter((beat) => beat < loop.endSec);
    if (target >= loop.endSec && side.length === 0) return null;
    return { startSec: snapToBeat(target, side), endSec: loop.endSec };
  }
  const side = beats.filter((beat) => beat > loop.startSec);
  if (target <= loop.startSec && side.length === 0) return null;
  return { startSec: loop.startSec, endSec: snapToBeat(target, side) };
}

// Long songs keep their early beats, as the analyser does (SPEC §4.3.1); the
// click then falls silent past the last one (§4.2).
export function clickGrid(beats: readonly number[]): readonly number[] {
  return beats.length > KB_MAX_GRID_BEATS
    ? beats.slice(0, KB_MAX_GRID_BEATS)
    : beats;
}
