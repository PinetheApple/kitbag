// Tap-to-type tempo numpad (SPEC §5.2, design §03): "out-of-range clamps on
// confirm rather than blocking the keypress". So a keypress is never rejected
// for being wrong, only for having nowhere left to go, and the range bites once,
// at confirm.
//
// The range is passed in, never declared here — core-state owns BPM_BOUNDS
// (§13.7); see bpmBounds.ts.

import type { BpmBounds } from './bpmBounds.ts';

const RADIX = 10;

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
function maxDigits(bounds: BpmBounds): number {
  return String(bounds.max).length;
}

export function pressDigit(
  entry: NumpadEntry,
  digit: number,
  bounds: BpmBounds,
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

/**
 * The BPM a confirm commits, or undefined if the pad was cleared. Clamps rather
 * than rejects — an out-of-range entry is a reachable state by design.
 */
export function confirmEntry(
  entry: NumpadEntry,
  bounds: BpmBounds,
): number | undefined {
  if (entry.digits.length === 0) return undefined;
  const typed = Number.parseInt(entry.digits, RADIX);
  if (Number.isNaN(typed)) return undefined;
  return Math.min(Math.max(typed, bounds.min), bounds.max);
}
