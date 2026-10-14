// Note names for MIDI note numbers. Worklet-safe: the frame callback names the
// target note on the UI thread.

const PITCH_CLASSES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

const SEMITONES_PER_OCTAVE = 12;
// MIDI 60 is C4, so octave 0 starts at MIDI 12.
const OCTAVE_OF_MIDI_ZERO = -1;

/** The MIDI note range a tuning may hold (the MIDI standard's 7-bit range). */
export const MIDI_NOTE_BOUNDS = { min: 0, max: 127 } as const;

function pitchClassIndex(midi: number): number {
  'worklet';
  const rounded = Math.round(midi);
  return (
    ((rounded % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) %
    SEMITONES_PER_OCTAVE
  );
}

/** Letter and accidental only, e.g. "G" or "F♯". */
export function pitchClassName(midi: number): string {
  'worklet';
  return PITCH_CLASSES[pitchClassIndex(midi)] ?? '';
}

export function octaveOf(midi: number): number {
  'worklet';
  return (
    Math.floor(Math.round(midi) / SEMITONES_PER_OCTAVE) + OCTAVE_OF_MIDI_ZERO
  );
}

/** Scientific pitch notation, e.g. 55 → "G3". */
export function noteName(midi: number): string {
  'worklet';
  return `${pitchClassName(midi)}${String(octaveOf(midi))}`;
}

/** Screen-reader form, e.g. 54 → "F sharp 3". */
export function spokenNoteName(midi: number): string {
  return `${pitchClassName(midi).replace('♯', ' sharp')} ${String(octaveOf(midi))}`;
}

const NOTE_PATTERN = /^(?<letter>[A-G])(?<sharp>♯?)(?<octave>-?\d+)$/;

/** Inverse of noteName. Throws on anything noteName would not produce. */
export function parseNote(name: string): number {
  const groups = NOTE_PATTERN.exec(name)?.groups;
  const pitchClass = PITCH_CLASSES.indexOf(
    `${groups?.letter ?? ''}${groups?.sharp ?? ''}` as (typeof PITCH_CLASSES)[number],
  );
  if (groups?.octave === undefined || pitchClass < 0) {
    throw new Error(`Not a note name: ${name}`);
  }
  return (
    (Number(groups.octave) - OCTAVE_OF_MIDI_ZERO) * SEMITONES_PER_OCTAVE +
    pitchClass
  );
}
