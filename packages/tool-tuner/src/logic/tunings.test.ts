import { KB_TUNER_INSTRUMENT, KB_TUNER_MAX_STRINGS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { MIDI_NOTE_BOUNDS } from './notes.ts';
import {
  addString,
  BUILT_IN_TUNINGS,
  DEFAULT_TUNING,
  isSavableDraft,
  pegItems,
  removeString,
  sameTuning,
  stepStringNote,
  tuningLabel,
} from './tunings.ts';

const STANDARD = [40, 45, 50, 55, 59, 64];

describe('built-in tunings', () => {
  it('carry the planned MIDI notes, low string first', () => {
    const byName = Object.fromEntries(
      BUILT_IN_TUNINGS.map((t) => [
        `${String(t.instrument)}:${t.name}`,
        t.notes,
      ]),
    );
    const guitar = KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_GUITAR;
    const bass = KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_BASS;
    const uke = KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_UKULELE;
    expect(byName[`${String(guitar)}:Standard E`]).toEqual(STANDARD);
    expect(byName[`${String(guitar)}:Drop D`]).toEqual([
      38, 45, 50, 55, 59, 64,
    ]);
    expect(byName[`${String(guitar)}:DADGAD`]).toEqual([
      38, 45, 50, 55, 57, 62,
    ]);
    expect(byName[`${String(guitar)}:Half-step down`]).toEqual([
      39, 44, 49, 54, 58, 63,
    ]);
    expect(byName[`${String(bass)}:4-string standard`]).toEqual([
      28, 33, 38, 43,
    ]);
    expect(byName[`${String(bass)}:5-string standard`]).toEqual([
      23, 28, 33, 38, 43,
    ]);
    expect(byName[`${String(uke)}:Standard C`]).toEqual([67, 60, 64, 69]);
  });

  it('are all within the engine string limit and the MIDI range', () => {
    for (const tuning of BUILT_IN_TUNINGS) {
      expect(tuning.notes.length).toBeGreaterThanOrEqual(1);
      expect(tuning.notes.length).toBeLessThanOrEqual(KB_TUNER_MAX_STRINGS);
      for (const note of tuning.notes) {
        expect(note).toBeGreaterThanOrEqual(MIDI_NOTE_BOUNDS.min);
        expect(note).toBeLessThanOrEqual(MIDI_NOTE_BOUNDS.max);
      }
      expect(isSavableDraft(tuning)).toBe(true);
    }
  });

  it('open on guitar standard', () => {
    expect(DEFAULT_TUNING.notes).toEqual(STANDARD);
    expect(tuningLabel(DEFAULT_TUNING)).toBe('Guitar · Standard E');
  });
});

describe('pegItems', () => {
  it('reads E A D G B e with strings numbered from the top', () => {
    const pegs = pegItems(STANDARD, []);
    expect(pegs.map((p) => p.note)).toEqual(['E', 'A', 'D', 'G', 'B', 'e']);
    expect(pegs.map((p) => p.stringNumber)).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
    ]);
  });

  it('lowercases only a repeated top letter', () => {
    expect(pegItems([38, 45, 50, 55, 57, 62], []).map((p) => p.note)).toEqual([
      'D',
      'A',
      'D',
      'G',
      'A',
      'd',
    ]);
    expect(pegItems([28, 33, 38, 43], []).map((p) => p.note)).toEqual([
      'E',
      'A',
      'D',
      'G',
    ]);
  });

  it('marks tuned strings and says so to screen readers', () => {
    const pegs = pegItems(STANDARD, [0, 3]);
    expect(pegs.map((p) => p.tuned)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(pegs[0]?.accessibilityLabel).toBe('String 6, E 2, in tune');
    expect(pegs[1]?.accessibilityLabel).toBe('String 5, A 2');
  });
});

describe('sameTuning', () => {
  it('matches custom tunings by id and built-ins by content', () => {
    expect(sameTuning(DEFAULT_TUNING, { ...DEFAULT_TUNING })).toBe(true);
    expect(sameTuning(DEFAULT_TUNING, { ...DEFAULT_TUNING, customId: 1 })).toBe(
      false,
    );
    expect(
      sameTuning(
        { ...DEFAULT_TUNING, customId: 1 },
        { ...DEFAULT_TUNING, name: 'Renamed', customId: 1 },
      ),
    ).toBe(true);
  });
});

describe('tuning editor steps', () => {
  it('steps one string within the MIDI range', () => {
    expect(stepStringNote(STANDARD, 0, -2)).toEqual([38, 45, 50, 55, 59, 64]);
    expect(stepStringNote([0, 127], 0, -1)).toEqual([0, 127]);
    expect(stepStringNote([0, 127], 1, 1)).toEqual([0, 127]);
  });

  it('adds and removes top strings within the engine limit', () => {
    expect(addString([40])).toEqual([40, 40]);
    expect(removeString([40, 45])).toEqual([40]);
    expect(removeString([40])).toEqual([40]);
    const full = Array.from({ length: KB_TUNER_MAX_STRINGS }, () => 40);
    expect(addString(full)).toBe(full);
  });

  it('refuses an unnamed draft or an unknown instrument', () => {
    const draft = { name: 'Open G', instrument: 0, notes: STANDARD };
    expect(isSavableDraft(draft)).toBe(true);
    expect(isSavableDraft({ ...draft, name: '  ' })).toBe(false);
    expect(isSavableDraft({ ...draft, instrument: 9 })).toBe(false);
    expect(isSavableDraft({ ...draft, notes: [] })).toBe(false);
  });
});
