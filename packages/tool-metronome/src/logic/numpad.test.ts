import { describe, expect, it } from 'vitest';

import {
  confirmEntry,
  openEntry,
  pressBackspace,
  pressDigit,
  type NumpadEntry,
} from './numpad.ts';
import type { BpmBounds } from './bpmBounds.ts';

// Mirrors core-state's BPM_BOUNDS shape; the screen passes the real one.
const BOUNDS: BpmBounds = { min: 20, max: 400 };

const type = (entry: NumpadEntry, digits: readonly number[]) =>
  digits.reduce((current, digit) => pressDigit(current, digit, BOUNDS), entry);

describe('numpad entry', () => {
  it('opens on the current tempo', () => {
    expect(openEntry(124).digits).toBe('124');
  });

  it('replaces the tempo it opened on with the first digit typed', () => {
    // The opening value is already three digits wide: without this the first
    // keypress would be silently swallowed by the width cap.
    expect(type(openEntry(124), [9]).digits).toBe('9');
    expect(type(openEntry(124), [9, 6]).digits).toBe('96');
  });

  it('appends digits up to the width of the widest tempo', () => {
    expect(type(openEntry(120), [1, 2, 3, 4]).digits).toBe('123');
  });

  it('drops a leading zero instead of rejecting the keypress', () => {
    expect(type(openEntry(120), [0, 4]).digits).toBe('4');
  });

  it('backspaces to empty and stays there', () => {
    expect(pressBackspace(type(openEntry(120), [1, 2])).digits).toBe('1');
    expect(
      pressBackspace(pressBackspace(type(openEntry(120), [1]))).digits,
    ).toBe('');
  });

  it('clears rather than edits a tempo the finger never typed', () => {
    expect(pressBackspace(openEntry(124)).digits).toBe('');
  });
});

describe('confirmEntry', () => {
  it('commits an in-range tempo unchanged', () => {
    expect(confirmEntry(type(openEntry(90), [1, 2, 4]), BOUNDS)).toBe(124);
  });

  it('commits the tempo it opened on when nothing was typed', () => {
    expect(confirmEntry(openEntry(124), BOUNDS)).toBe(124);
  });

  it('clamps out of range on confirm, not on the keypress (SPEC §5.2)', () => {
    const typed = type(openEntry(120), [9, 9, 9]);
    expect(typed.digits).toBe('999');
    expect(confirmEntry(typed, BOUNDS)).toBe(BOUNDS.max);
    expect(confirmEntry(type(openEntry(120), [5]), BOUNDS)).toBe(BOUNDS.min);
  });

  it('commits nothing from a cleared pad', () => {
    expect(
      confirmEntry(pressBackspace(openEntry(124)), BOUNDS),
    ).toBeUndefined();
  });
});
