// What the readout says about a reading: needle position, caption, direction.
// Worklet-safe where the frame callback calls it. The caption follows the
// design ("−4 CENTS · TUNE UP"), not the functional spec's step numbers, which
// are informative only (docs/decisions.md, 2026-10-14).

import { KB_TUNING_STATUS } from '@kitbag/core-native';

/** Cents at either end of the strip; beyond it the needle pins to the edge. */
export const NEEDLE_FULL_SCALE_CENTS = 50;

/** Cents error → needle position in [-1, 1]; 0 for a non-finite error. */
export function needleFraction(cents: number): number {
  'worklet';
  if (!Number.isFinite(cents)) return 0;
  return Math.min(1, Math.max(-1, cents / NEEDLE_FULL_SCALE_CENTS));
}

const MINUS = '−';
const PLUS = '+';

export const IDLE_CAPTION = {
  strings: 'PLAY A STRING',
  chromatic: 'PLAY A NOTE',
} as const;

export function signedCents(cents: number): string {
  'worklet';
  const rounded = Math.round(cents);
  if (rounded === 0) return '0';
  return `${rounded < 0 ? MINUS : PLUS}${String(Math.abs(rounded))}`;
}

/** Caption under the note. Direction comes from the engine's status, not the sign. */
export function tunerCaption(status: number, cents: number): string {
  'worklet';
  if (status === KB_TUNING_STATUS.KB_TUNING_IN_TUNE) return 'IN TUNE';
  const amount = signedCents(cents);
  const unit = Math.abs(Math.round(cents)) === 1 ? 'CENT' : 'CENTS';
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_LOW) {
    return `${amount} ${unit} · TUNE UP`;
  }
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_HIGH) {
    return `${amount} ${unit} · TUNE DOWN`;
  }
  return '';
}

/** A key of core-design's TUNE_DIRECTION, which TuneDirectionIcon draws. */
export type TuneDirectionKey = 'up' | 'down' | 'inTune' | 'none';

export function tuneDirection(status: number): TuneDirectionKey {
  'worklet';
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_LOW) return 'up';
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_HIGH) return 'down';
  if (status === KB_TUNING_STATUS.KB_TUNING_IN_TUNE) return 'inTune';
  return 'none';
}

/** Screen-reader words for a status; changes only when the status does. */
export function statusSpeech(status: number): string {
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_LOW) return 'Tune up';
  if (status === KB_TUNING_STATUS.KB_TUNING_TOO_HIGH) return 'Tune down';
  if (status === KB_TUNING_STATUS.KB_TUNING_IN_TUNE) return 'In tune';
  return '';
}
