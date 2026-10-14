// Holds the discrete slice back until it is stable, so a status flickering at
// the in-tune edge re-renders and is announced once, not on every hop.

import { sameDiscrete, type TunerDiscrete } from './hop.ts';

// A judgement, not a measurement: long enough to swallow edge flicker at hop
// rate, short enough that a real change reads as prompt. Feel is a device check.
export const DISCRETE_DWELL_MS = 250;

export interface DiscreteDwell {
  /** What React was last told. */
  readonly shown: TunerDiscrete;
  /** The latest slice, waiting out the dwell. */
  readonly pending: TunerDiscrete;
  /** Frame time `pending` first appeared, in ms. */
  readonly since: number;
}

export function dwellAt(shown: TunerDiscrete): DiscreteDwell {
  'worklet';
  return { shown, pending: shown, since: 0 };
}

/** Returns `dwell` itself when nothing changed, so a frame allocates nothing. */
export function settleDiscrete(
  dwell: DiscreteDwell,
  next: TunerDiscrete,
  nowMs: number,
): DiscreteDwell {
  'worklet';
  if (!sameDiscrete(next, dwell.pending)) {
    return { shown: dwell.shown, pending: next, since: nowMs };
  }
  if (
    sameDiscrete(dwell.pending, dwell.shown) ||
    nowMs - dwell.since < DISCRETE_DWELL_MS
  ) {
    return dwell;
  }
  return { shown: dwell.pending, pending: dwell.pending, since: dwell.since };
}
