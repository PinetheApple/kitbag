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
   * The sheet opens showing the current value. That value is a starting point,
   * not typing: the first digit replaces it, so the first keypress is never
   * swallowed by the digit-width cap.
   */
  readonly untouched: boolean;
}

export function openNumpadEntry(value: number): NumpadEntry {
  return { digits: String(value), untouched: true };
}

function maxDigits(bounds: NumberBounds): number {
  return String(bounds.max).length;
}

export function pressNumpadDigit(
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

export function pressNumpadBackspace(entry: NumpadEntry): NumpadEntry {
  // Backspacing a still-untouched entry clears it, rather than editing a number
  // the finger never typed.
  if (entry.untouched) return { digits: '', untouched: false };
  return { digits: entry.digits.slice(0, -1), untouched: false };
}

export function numpadDigits(entry: NumpadEntry): string {
  return entry.digits === '' ? TEXT_PLACEHOLDER : entry.digits;
}

export function numpadEntryLabel(
  entry: NumpadEntry,
  title: string,
  unit: string,
): string {
  if (entry.digits === '') return `${title}, ${NOTHING_ENTERED}`;
  return `${title}, ${entry.digits} ${unit}`;
}

export function numpadBoundsHint(bounds: NumberBounds, unit: string): string {
  return `${String(bounds.min)} – ${String(bounds.max)} ${unit}`;
}

export function confirmNumpadEntry(
  entry: NumpadEntry,
  bounds: NumberBounds,
): number | undefined {
  if (entry.digits.length === 0) return undefined;
  const typed = Number.parseInt(entry.digits, RADIX);
  if (Number.isNaN(typed)) return undefined;
  return Math.min(Math.max(typed, bounds.min), bounds.max);
}
