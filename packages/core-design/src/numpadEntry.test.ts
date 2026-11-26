import { describe, expect, it } from 'vitest';

import {
  confirmNumpadEntry,
  numpadBoundsHint,
  numpadDigits,
  numpadEntryLabel,
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  type NumpadEntry,
  type NumberBounds,
} from './numpadEntry.ts';
import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';

const BOUNDS: NumberBounds = { min: 20, max: 400 };

const type = (entry: NumpadEntry, digits: readonly number[]) =>
  digits.reduce(
    (current, digit) => pressNumpadDigit(current, digit, BOUNDS),
    entry,
  );

describe('numpad entry', () => {
  it('opens on the current tempo', () => {
    expect(openNumpadEntry(124).digits).toBe('124');
  });

  it('replaces the tempo it opened on with the first digit typed', () => {
    // The opening value is already three digits wide: without this the first
    // keypress would be silently swallowed by the width cap.
    expect(type(openNumpadEntry(124), [9]).digits).toBe('9');
    expect(type(openNumpadEntry(124), [9, 6]).digits).toBe('96');
  });

  it('appends digits up to the width of the widest tempo', () => {
    expect(type(openNumpadEntry(120), [1, 2, 3, 4]).digits).toBe('123');
  });

  it('drops a leading zero instead of rejecting the keypress', () => {
    expect(type(openNumpadEntry(120), [0, 4]).digits).toBe('4');
  });

  it('backspaces to empty and stays there', () => {
    expect(
      pressNumpadBackspace(type(openNumpadEntry(120), [1, 2])).digits,
    ).toBe('1');
    expect(
      pressNumpadBackspace(
        pressNumpadBackspace(type(openNumpadEntry(120), [1])),
      ).digits,
    ).toBe('');
  });

  it('clears rather than edits a tempo the finger never typed', () => {
    expect(pressNumpadBackspace(openNumpadEntry(124)).digits).toBe('');
  });
});

describe('confirmNumpadEntry', () => {
  it('commits an in-range tempo unchanged', () => {
    expect(
      confirmNumpadEntry(type(openNumpadEntry(90), [1, 2, 4]), BOUNDS),
    ).toBe(124);
  });

  it('commits the tempo it opened on when nothing was typed', () => {
    expect(confirmNumpadEntry(openNumpadEntry(124), BOUNDS)).toBe(124);
  });

  it('clamps out of range on confirm, not on the keypress (SPEC §5.2)', () => {
    const typed = type(openNumpadEntry(120), [9, 9, 9]);
    expect(typed.digits).toBe('999');
    expect(confirmNumpadEntry(typed, BOUNDS)).toBe(BOUNDS.max);
    expect(confirmNumpadEntry(type(openNumpadEntry(120), [5]), BOUNDS)).toBe(
      BOUNDS.min,
    );
  });

  it('commits nothing from a cleared pad', () => {
    expect(
      confirmNumpadEntry(pressNumpadBackspace(openNumpadEntry(124)), BOUNDS),
    ).toBeUndefined();
  });
});

describe('numpad display', () => {
  const cleared = pressNumpadBackspace(openNumpadEntry(124));

  it('shows the digits typed', () => {
    expect(numpadDigits(type(openNumpadEntry(90), [1, 2]))).toBe('12');
  });

  it('renders the placeholder when cleared', () => {
    expect(numpadDigits(cleared)).toBe(TEXT_PLACEHOLDER);
    expect(TEXT_PLACEHOLDER).toBe('\u00A0');
  });

  it('announces the value with its unit', () => {
    expect(numpadEntryLabel(openNumpadEntry(124), 'Tempo', 'BPM')).toBe(
      'Tempo, 124 BPM',
    );
  });

  it('announces a cleared pad in words, not the placeholder', () => {
    const label = numpadEntryLabel(cleared, 'Tempo', 'BPM');
    expect(label).toBe('Tempo, nothing entered');
    expect(label).not.toContain(TEXT_PLACEHOLDER);
  });

  it('names the range a confirm clamps to', () => {
    expect(numpadBoundsHint(BOUNDS, 'BPM')).toBe('20 – 400 BPM');
  });
});
