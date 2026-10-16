// The displayed cents between hops and the needle's return to centre on
// silence (docs/tuner-functional-spec.md §5, D2 and D4). Worklet-safe.

/** No displayed value: the first hop after a clear is shown as-is. */
export const NO_DISPLAYED_CENTS = Number.NaN;

const SMOOTH_WEIGHT = 0.5;

/**
 * D2: the next displayed cents, averaged with the previous displayed value.
 * Call once per new hop, not per frame.
 */
export function smoothCents(previous: number, cents: number): number {
  'worklet';
  if (!Number.isFinite(cents)) return previous;
  if (!Number.isFinite(previous)) return cents;
  return previous * SMOOTH_WEIGHT + cents * (1 - SMOOTH_WEIGHT);
}

/** D4: the needle keeps this fraction of its offset every NEEDLE_RETURN_STEP_MS. */
export const NEEDLE_RETURN_FACTOR = 0.8;
const MS_PER_SECOND = 1000;
const RETURN_STEPS_PER_SECOND = 60;
export const NEEDLE_RETURN_STEP_MS = MS_PER_SECOND / RETURN_STEPS_PER_SECOND;

/**
 * D4: the needle's offset after `elapsedMs` of silence. Time-based, so
 * frame-rate independent: 225 ms leaves ≈ 5 % at any frame size.
 */
export function decayNeedle(
  current: number,
  elapsedMs: number,
  reduceMotion: boolean,
): number {
  'worklet';
  if (reduceMotion || !Number.isFinite(current)) return 0;
  return (
    current *
    Math.pow(
      NEEDLE_RETURN_FACTOR,
      Math.max(0, elapsedMs) / NEEDLE_RETURN_STEP_MS,
    )
  );
}
