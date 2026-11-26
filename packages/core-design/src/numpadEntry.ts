// A keypress is rejected only when no digit fits; the range clamps once, at
// confirm.

import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';

export interface NumberBounds {
  readonly min: number;
  readonly max: number;
}

const RADIX = 10;
const NOTHING_ENTERED = 'nothing entered';

export interface NumpadEntry {
  readonly digits: string;
  /**
   * The sheet opens showing the current tempo, as the design draws it. That
   * value is a starting point, not typing: the first digit replaces it, so the
   * first keypress is never swallowed by the digit-width cap.
   */
  readonly untouched: boolean;
}

export function openEntry(bpm: number): NumpadEntry {
  return { digits: String(bpm), untouched: true };
}

// Width of the largest in-range tempo. A full-width entry can still be out of
// range (999 with a 400 ceiling) — that is what the confirm clamp is for.
function maxDigits(bounds: NumberBounds): number {
  return String(bounds.max).length;
}

export function pressDigit(
  entry: NumpadEntry,
  digit: number,
  bounds: NumberBounds,
): NumpadEntry {
  if (entry.untouched) return { digits: String(digit), untouched: false };
  if (entry.digits.length >= maxDigits(bounds)) return entry;
  // A leading zero would make "0" then "40" read as "040"; drop it rather than
  // reject the keypress.
  const digits = (entry.digits + String(digit)).replace(/^0+(?=\d)/, '');
  return { digits, untouched: false };
}

export function pressBackspace(entry: NumpadEntry): NumpadEntry {
  // Backspacing a still-untouched entry clears it, rather than editing a number
  // the finger never typed.
  if (entry.untouched) return { digits: '', untouched: false };
  return { digits: entry.digits.slice(0, -1), untouched: false };
}

export function displayDigits(entry: NumpadEntry): string {
  return entry.digits === '' ? TEXT_PLACEHOLDER : entry.digits;
}

export function entryLabel(
  entry: NumpadEntry,
  title: string,
  unit: string,
): string {
  if (entry.digits === '') return `${title}, ${NOTHING_ENTERED}`;
  return `${title}, ${entry.digits} ${unit}`;
}

/**
 * The BPM a confirm commits, or undefined if the pad was cleared. Clamps rather
 * than rejects — an out-of-range entry is a reachable state by design.
 */
export function confirmEntry(
  entry: NumpadEntry,
  bounds: NumberBounds,
): number | undefined {
  if (entry.digits.length === 0) return undefined;
  const typed = Number.parseInt(entry.digits, RADIX);
  if (Number.isNaN(typed)) return undefined;
  return Math.min(Math.max(typed, bounds.min), bounds.max);
}
