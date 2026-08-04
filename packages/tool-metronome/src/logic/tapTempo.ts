// TAP in the preset row (SPEC §5.2). Timestamps in, BPM out — no timers, no
// state, so the averaging is testable headlessly. The BPM range comes from
// core-state (§13.7) as an argument; see bpmBounds.ts.

import type { BpmBounds } from './bpmBounds.ts';

// A slack factor on the slowest legal tap: a finger keeping 20 BPM will not
// land every interval exactly, and a series must survive that wobble.
const TIMEOUT_SLACK = 1.5;

/** Intervals averaged. Four is two bars of 4/4 worth of taps — long enough to
 * average out a shaky finger, short enough to follow a tempo being felt out. */
export const TAP_WINDOW_INTERVALS = 4;

const MS_PER_MINUTE = 60000;
const MIN_TAPS_FOR_TEMPO = 2;

/**
 * A gap longer than this starts a new series rather than averaging across a
 * pause. Derived from the slowest tempo the range allows: a fixed 2 s would sit
 * at 30 BPM and make every tap under it unreachable by TAP.
 */
export function tapTimeoutMs(bounds: BpmBounds): number {
  return (MS_PER_MINUTE / bounds.min) * TIMEOUT_SLACK;
}

/** Append a tap, dropping the series if the last tap has gone stale. */
export function pushTap(
  taps: readonly number[],
  nowMs: number,
  bounds: BpmBounds,
): readonly number[] {
  const last = taps.at(-1);
  if (last === undefined || nowMs - last > tapTimeoutMs(bounds)) return [nowMs];
  return [...taps, nowMs].slice(-(TAP_WINDOW_INTERVALS + 1));
}

/** BPM implied by a tap series, or undefined while it is too short to mean
 * anything. Unclamped: the store owns the BPM range. */
export function tapTempoBpm(taps: readonly number[]): number | undefined {
  if (taps.length < MIN_TAPS_FOR_TEMPO) return undefined;
  const first = taps[0];
  const last = taps.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const span = last - first;
  if (span <= 0) return undefined;
  const meanInterval = span / (taps.length - 1);
  return Math.round(MS_PER_MINUTE / meanInterval);
}
