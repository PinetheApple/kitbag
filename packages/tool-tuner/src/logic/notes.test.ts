import { describe, expect, it } from 'vitest';

import {
  noteName,
  parseNote,
  pitchClassName,
  spokenNoteName,
} from './notes.ts';

describe('noteName', () => {
  it('uses scientific pitch notation with C4 = 60', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(40)).toBe('E2');
    expect(noteName(55)).toBe('G3');
    expect(noteName(69)).toBe('A4');
    expect(noteName(0)).toBe('C-1');
    expect(noteName(127)).toBe('G9');
  });

  it('spells accidentals as sharps', () => {
    expect(noteName(54)).toBe('F♯3');
    expect(pitchClassName(61)).toBe('C♯');
  });

  it('rounds a fractional MIDI note to the nearest semitone', () => {
    expect(noteName(54.6)).toBe('G3');
    expect(noteName(55.4)).toBe('G3');
  });

  it('reads sharps out in words', () => {
    expect(spokenNoteName(54)).toBe('F sharp 3');
    expect(spokenNoteName(40)).toBe('E 2');
  });
});

describe('parseNote', () => {
  it('round-trips every MIDI note', () => {
    for (let midi = 0; midi <= 127; midi++) {
      expect(parseNote(noteName(midi))).toBe(midi);
    }
  });

  it('rejects anything else', () => {
    expect(() => parseNote('H2')).toThrow();
    expect(() => parseNote('E')).toThrow();
    expect(() => parseNote('E♭2')).toThrow();
  });
});
