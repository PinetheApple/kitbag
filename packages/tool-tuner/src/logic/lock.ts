// The in-tune lock event and the needle's motion between hops. Worklet-safe.

import { KB_TUNER_NO_STRING } from '@kitbag/core-native';

import { isLocked, type TunerHop } from './hop.ts';

/** Hops up to `resetId` were measured before the last reset. */
export function lockArmed(resetId: number, hopId: number): boolean {
  'worklet';
  return hopId > resetId;
}

/**
 * Locks arm after a reset only once a later hop is heard unlocked: a hop that
 * beat the engine to the new tuning or mode still belongs to the old one.
 */
export function nextArmed(
  armed: boolean,
  hop: TunerHop,
  resetId: number,
): boolean {
  'worklet';
  return armed || (lockArmed(resetId, hop.id) && !isLocked(hop));
}

/**
 * The string the lock is latched on after this hop, or KB_TUNER_NO_STRING.
 * A latch holds while the string stays locked and clears as soon as it is
 * not, so the next lock on the same string latches again.
 */
export function nextLatch(hop: TunerHop, armed: boolean): number {
  'worklet';
  return armed && isLocked(hop) ? hop.currentString : KB_TUNER_NO_STRING;
}

/** True on the hop a string becomes locked: report it once, not every hop. */
export function lockFired(previous: number, next: number): boolean {
  'worklet';
  return next !== KB_TUNER_NO_STRING && next !== previous;
}

// Time constant of the needle's follow between hops, chosen to smooth the hop
// steps. A judgement, not a measurement: settle feel is a device check.
export const NEEDLE_FOLLOW_MS = 50;

/**
 * Exponential follow toward `target` over `elapsedMs`. Frame-rate independent:
 * two 8 ms frames move the needle as far as one 16 ms frame.
 */
export function followNeedle(
  current: number,
  target: number,
  elapsedMs: number,
  reduceMotion: boolean,
): number {
  'worklet';
  if (reduceMotion || !Number.isFinite(current)) return target;
  const step = 1 - Math.exp(-Math.max(0, elapsedMs) / NEEDLE_FOLLOW_MS);
  return current + (target - current) * step;
}
