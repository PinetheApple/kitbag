// The displayed reading carried from hop to hop: D2's averaged cents, the
// note they belong to, and the status every channel derives from them.

import { KB_TUNER_NO_NOTE, KB_TUNING_STATUS } from '@kitbag/core-native';

import { isHeard, type TunerHop } from './hop.ts';
import { NO_DISPLAYED_CENTS, smoothCents } from './needle.ts';

export interface DisplayedReading {
  readonly cents: number;
  readonly targetMidi: number;
  readonly status: number;
}

export const NO_READING: DisplayedReading = {
  cents: NO_DISPLAYED_CENTS,
  targetMidi: KB_TUNER_NO_NOTE,
  status: KB_TUNING_STATUS.KB_TUNING_NOT_MEASURED,
};

/** A new target note starts the average over rather than mixing two notes' errors. */
export function averagedFrom(
  previous: DisplayedReading,
  hop: TunerHop,
): number {
  'worklet';
  return hop.targetMidi === previous.targetMidi
    ? previous.cents
    : NO_DISPLAYED_CENTS;
}

/**
 * The status of the displayed cents against the string's in-tune window, in
 * whole cents, so the caption, arrow and needle cannot disagree. The engine's
 * own status follows the raw hop and is not used for display.
 */
export function displayedStatus(cents: number, windowCents: number): number {
  'worklet';
  if (!Number.isFinite(cents)) return KB_TUNING_STATUS.KB_TUNING_NOT_MEASURED;
  const rounded = Math.round(cents);
  if (Math.abs(rounded) <= windowCents) {
    return KB_TUNING_STATUS.KB_TUNING_IN_TUNE;
  }
  return rounded < 0
    ? KB_TUNING_STATUS.KB_TUNING_TOO_LOW
    : KB_TUNING_STATUS.KB_TUNING_TOO_HIGH;
}

/** Call once per new hop. */
export function nextReading(
  previous: DisplayedReading,
  hop: TunerHop,
): DisplayedReading {
  'worklet';
  if (!isHeard(hop)) return NO_READING;
  const cents = smoothCents(averagedFrom(previous, hop), hop.errorCents);
  return {
    cents,
    targetMidi: hop.targetMidi,
    status: displayedStatus(cents, hop.inTuneThresholdCents),
  };
}
