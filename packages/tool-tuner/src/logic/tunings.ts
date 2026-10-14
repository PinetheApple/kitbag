// Built-in tunings and the labels the screen draws for a tuning. Built-ins are
// read-only code constants; only custom tunings are rows in the tunings table
// (docs/decisions.md, 2026-10-14).

import type { PegItem } from '@kitbag/core-design';
import { KB_TUNER_INSTRUMENT, KB_TUNER_MAX_STRINGS } from '@kitbag/core-native';
import type { TunerTuning } from '@kitbag/core-state';

import {
  MIDI_NOTE_BOUNDS,
  parseNote,
  pitchClassName,
  spokenNoteName,
} from './notes.ts';

const { KB_TUNER_INSTRUMENT_GUITAR, KB_TUNER_INSTRUMENT_BASS } =
  KB_TUNER_INSTRUMENT;

function preset(name: string, instrument: number, notes: string): TunerTuning {
  return { name, instrument, notes: notes.split(' ').map(parseNote) };
}

/** The tuning a first visit opens on. Pass to the store's `enter`. */
export const DEFAULT_TUNING: TunerTuning = preset(
  'Standard E',
  KB_TUNER_INSTRUMENT_GUITAR,
  'E2 A2 D3 G3 B3 E4',
);

/** Low string first, in the order the strings sit on the instrument. */
export const BUILT_IN_TUNINGS: readonly TunerTuning[] = [
  DEFAULT_TUNING,
  preset('Drop D', KB_TUNER_INSTRUMENT_GUITAR, 'D2 A2 D3 G3 B3 E4'),
  preset('DADGAD', KB_TUNER_INSTRUMENT_GUITAR, 'D2 A2 D3 G3 A3 D4'),
  preset(
    'Half-step down',
    KB_TUNER_INSTRUMENT_GUITAR,
    'D♯2 G♯2 C♯3 F♯3 A♯3 D♯4',
  ),
  preset('4-string standard', KB_TUNER_INSTRUMENT_BASS, 'E1 A1 D2 G2'),
  preset('5-string standard', KB_TUNER_INSTRUMENT_BASS, 'B0 E1 A1 D2 G2'),
  // Re-entrant: the G string is higher than the C beside it.
  preset(
    'Standard C',
    KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_UKULELE,
    'G4 C4 E4 A4',
  ),
];

export const INSTRUMENT_LABELS: Readonly<Record<number, string>> = {
  [KB_TUNER_INSTRUMENT_GUITAR]: 'Guitar',
  [KB_TUNER_INSTRUMENT_BASS]: 'Bass',
  [KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_UKULELE]: 'Ukulele',
  [KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_OTHER]: 'Other',
};

export function instrumentLabel(instrument: number): string {
  return INSTRUMENT_LABELS[instrument] ?? 'Other';
}

/** "Guitar · Standard E" — the app bar chip and the Home tile subtext. */
export function tuningLabel(tuning: TunerTuning): string {
  return `${instrumentLabel(tuning.instrument)} · ${tuning.name}`;
}

export function sameTuning(a: TunerTuning, b: TunerTuning): boolean {
  if (a.customId !== undefined || b.customId !== undefined) {
    return a.customId === b.customId;
  }
  return (
    a.name === b.name &&
    a.instrument === b.instrument &&
    a.notes.length === b.notes.length &&
    a.notes.every((note, i) => note === b.notes[i])
  );
}

/** String number counted from the highest string, as players number them. */
export function stringNumber(index: number, stringCount: number): number {
  return stringCount - index;
}

/**
 * One peg per string, low string first. The top string's letter is lowercased
 * when another string shares it, so standard tuning reads E A D G B e.
 */
export function pegItems(
  notes: readonly number[],
  tunedStrings: readonly number[],
): PegItem[] {
  const letters = notes.map(pitchClassName);
  const top = letters.length - 1;
  return notes.map((midi, index) => {
    const letter = letters[index] ?? '';
    const repeated =
      index === top && letters.some((l, i) => i !== top && l === letter);
    const number = stringNumber(index, notes.length);
    const tuned = tunedStrings.includes(index);
    return {
      note: repeated ? letter.toLowerCase() : letter,
      stringNumber: String(number),
      accessibilityLabel: `String ${String(number)}, ${spokenNoteName(midi)}${tuned ? ', in tune' : ''}`,
      tuned,
    };
  });
}

// --- Custom tuning editor ----------------------------------------------------

export interface TuningDraft {
  readonly name: string;
  readonly instrument: number;
  readonly notes: readonly number[];
}

export const STRING_COUNT_BOUNDS = {
  min: 1,
  max: KB_TUNER_MAX_STRINGS,
} as const;

export function draftFrom(tuning: TunerTuning, name: string): TuningDraft {
  return { name, instrument: tuning.instrument, notes: tuning.notes };
}

function clampNote(midi: number): number {
  return Math.min(MIDI_NOTE_BOUNDS.max, Math.max(MIDI_NOTE_BOUNDS.min, midi));
}

export function stepStringNote(
  notes: readonly number[],
  index: number,
  delta: number,
): readonly number[] {
  return notes.map((note, i) => (i === index ? clampNote(note + delta) : note));
}

/** Adds a top string at the current top string's pitch. */
export function addString(notes: readonly number[]): readonly number[] {
  if (notes.length >= STRING_COUNT_BOUNDS.max) return notes;
  const top = notes[notes.length - 1];
  return top === undefined ? notes : [...notes, top];
}

/** Removes the top string. */
export function removeString(notes: readonly number[]): readonly number[] {
  if (notes.length <= STRING_COUNT_BOUNDS.min) return notes;
  return notes.slice(0, -1);
}

export function isSavableDraft(draft: TuningDraft): boolean {
  return (
    draft.name.trim().length > 0 &&
    draft.notes.length >= STRING_COUNT_BOUNDS.min &&
    draft.notes.length <= STRING_COUNT_BOUNDS.max &&
    draft.notes.every(
      (note) =>
        Number.isInteger(note) &&
        note >= MIDI_NOTE_BOUNDS.min &&
        note <= MIDI_NOTE_BOUNDS.max,
    ) &&
    Object.values(KB_TUNER_INSTRUMENT).some((v) => v === draft.instrument)
  );
}
