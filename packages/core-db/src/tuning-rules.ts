// core-db may not import core-native (§13.1), so these mirror
// kitbag_tuner_api.h and tuning_mode.h; engine-limits.test.ts fails if either
// side drifts.
export const MAX_STRINGS = 12;
export const MAX_MIDI_NOTE = 127;
export const INSTRUMENTS = {
  guitar: 0,
  bass: 1,
  ukulele: 2,
  other: 3,
} as const;
export const INSTRUMENT_COUNT = Object.keys(INSTRUMENTS).length;

export interface TuningShape {
  instrument: number;
  notes: readonly number[];
}

export interface TuningViolation {
  field: keyof TuningShape;
  reason: string;
}

const within = (value: number, high: number) =>
  Number.isInteger(value) && value >= 0 && value <= high;

function instrumentViolation(instrument: number): TuningViolation | undefined {
  if (within(instrument, INSTRUMENT_COUNT - 1)) return undefined;
  return {
    field: 'instrument',
    reason: `expected 0–${String(INSTRUMENT_COUNT - 1)}`,
  };
}

export function tuningViolation(
  tuning: TuningShape,
): TuningViolation | undefined {
  const { notes } = tuning;
  if (notes.length < 1 || notes.length > MAX_STRINGS)
    return {
      field: 'notes',
      reason: `expected 1–${String(MAX_STRINGS)} strings`,
    };
  if (!notes.every((note) => within(note, MAX_MIDI_NOTE)))
    return {
      field: 'notes',
      reason: `expected notes 0–${String(MAX_MIDI_NOTE)}`,
    };
  return instrumentViolation(tuning.instrument);
}
