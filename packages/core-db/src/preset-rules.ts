// core-db may not import core-native (§13.1), so these mirror the engine headers;
// engine-limits.test.ts fails if either side drifts.
export const MIN_BPM = 20;
export const MAX_BPM = 400;
export const MAX_BEATS = 16;
export const MAX_POLY_BEATS = 16;
export const POLY_AGAINST_BAR = 0;
export const MIN_POLY_AGAINST = 1;
export const MAX_POLY_AGAINST = MAX_BEATS;
export const MAX_SUBDIVISION = 16;
export const MAX_RAMP_BARS = 64;
export const MAX_MUTE_BARS = 16;
export const MIN_RAMP_SECONDS = 1;
export const MAX_RAMP_SECONDS = 3600;
export const MIN_RAMP_STEP = 1;
const MAX_STEP = MAX_BPM - MIN_BPM;
const SECONDS_PER_MINUTE = 60;
export const RAMP_UNITS = { bars: 0, seconds: 1, minutes: 2 } as const;
enum Denominator {
  Half = 2,
  Quarter = 4,
  Eighth = 8,
  Sixteenth = 16,
}
export const DENOMINATORS: readonly number[] = [
  Denominator.Half,
  Denominator.Quarter,
  Denominator.Eighth,
  Denominator.Sixteenth,
];
export const DEFAULT_DENOMINATOR = Denominator.Quarter;
export const SOUND_COUNT = 6;
export const CUSTOM_SOUND_SLOTS = 2;
export const SOUND_ID_COUNT = SOUND_COUNT + CUSTOM_SOUND_SLOTS;
export const TICK_SOUND = 4;
export const MAX_CUSTOM_SOUND_SECONDS = 2;
export const CUSTOM_SOUND_RATE = 48000;
export const CUSTOM_SOUND_SAMPLE_BYTES = 4;
export const WAV_HEADER_BYTES = 44;
export const MAX_CUSTOM_SOUND_WAV_BYTES =
  WAV_HEADER_BYTES +
  MAX_CUSTOM_SOUND_SECONDS * CUSTOM_SOUND_RATE * CUSTOM_SOUND_SAMPLE_BYTES;
export const ACCENT_LEVELS = 3;
export const NORMAL_ACCENT = 1;

export const PER_ACCENT_SOUND_BYTES = 2;

export interface PresetShape {
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  denominator: number;
  sound: number;
  polyBeats: number;
  polyAgainst?: number | undefined;
  rampStartBpm: number | null;
  rampEndBpm: number | null;
  rampLength: number | null;
  rampUnit: number;
  rampStep?: number | undefined;
  barMutePlayBars: number | null;
  barMuteMuteBars: number | null;
  accents: Uint8Array;
  perAccentSounds: Uint8Array | null;
  polyAccents: Uint8Array | null;
}

type NumericField = {
  [K in keyof PresetShape]-?: PresetShape[K] extends number | null ? K : never;
}[keyof PresetShape];

export interface PresetBound {
  field: NumericField;
  column: string;
  low: number;
  high: number;
  integer: boolean;
}

// The v9 repair builds its SQL from these, so they keep v9's columns and sound ids;
// later columns and the custom sound ids are checked outside them.
export const PRESET_BOUNDS: readonly PresetBound[] = [
  { field: 'bpm', column: 'bpm', low: MIN_BPM, high: MAX_BPM, integer: false },
  {
    field: 'beatsPerBar',
    column: 'beats_per_bar',
    low: 1,
    high: MAX_BEATS,
    integer: true,
  },
  {
    field: 'subdivision',
    column: 'subdivision',
    low: 1,
    high: MAX_SUBDIVISION,
    integer: true,
  },
  {
    field: 'sound',
    column: 'sound',
    low: 0,
    high: SOUND_COUNT - 1,
    integer: true,
  },
  {
    field: 'polyBeats',
    column: 'poly_beats',
    low: 0,
    high: MAX_POLY_BEATS,
    integer: true,
  },
  {
    field: 'rampStartBpm',
    column: 'ramp_start_bpm',
    low: MIN_BPM,
    high: MAX_BPM,
    integer: false,
  },
  {
    field: 'rampEndBpm',
    column: 'ramp_end_bpm',
    low: MIN_BPM,
    high: MAX_BPM,
    integer: false,
  },
  {
    field: 'rampLength',
    column: 'ramp_length',
    low: 1,
    high: MAX_RAMP_BARS,
    integer: true,
  },
  {
    field: 'barMutePlayBars',
    column: 'bar_mute_play_bars',
    low: 1,
    high: MAX_MUTE_BARS,
    integer: true,
  },
  {
    field: 'barMuteMuteBars',
    column: 'bar_mute_mute_bars',
    low: 1,
    high: MAX_MUTE_BARS,
    integer: true,
  },
];

export interface RuleViolation {
  field: keyof PresetShape;
  reason: string;
}

const nullOrWithin = (value: number | null, bound: PresetBound) =>
  value === null ||
  (Number.isFinite(value) &&
    (!bound.integer || Number.isInteger(value)) &&
    value >= bound.low &&
    value <= bound.high);

function rampLengthBound(unit: number): PresetBound | undefined {
  if (unit === RAMP_UNITS.bars) return undefined;
  const scale = unit === RAMP_UNITS.minutes ? SECONDS_PER_MINUTE : 1;
  return {
    field: 'rampLength',
    column: 'ramp_length',
    low: MIN_RAMP_SECONDS / scale,
    high: MAX_RAMP_SECONDS / scale,
    integer: false,
  };
}

const SOUND_ID_BOUND: PresetBound = {
  field: 'sound',
  column: 'sound',
  low: 0,
  high: SOUND_ID_COUNT - 1,
  integer: true,
};

function boundViolation(preset: PresetShape): RuleViolation | undefined {
  const overrides = [rampLengthBound(preset.rampUnit), SOUND_ID_BOUND];
  const bounds = PRESET_BOUNDS.map(
    (bound) =>
      overrides.find((override) => override?.field === bound.field) ?? bound,
  );
  const failed = bounds.find(
    (bound) => !nullOrWithin(preset[bound.field], bound),
  );
  return (
    failed && {
      field: failed.field,
      reason: `expected ${String(failed.low)}–${String(failed.high)}`,
    }
  );
}

function bytesProblem(
  bytes: Uint8Array,
  lengths: readonly number[],
  limit: number,
): string | undefined {
  if (!lengths.includes(bytes.length))
    return `expected ${lengths.join(' or ')} bytes`;
  if (bytes.some((byte) => byte >= limit))
    return `expected bytes below ${String(limit)}`;
  return undefined;
}

function blobViolation(preset: PresetShape): RuleViolation | undefined {
  const checks: [keyof PresetShape, Uint8Array | null, number[], number][] = [
    ['accents', preset.accents, [preset.beatsPerBar], ACCENT_LEVELS],
    [
      'perAccentSounds',
      preset.perAccentSounds,
      [0, PER_ACCENT_SOUND_BYTES],
      SOUND_ID_COUNT,
    ],
    ['polyAccents', preset.polyAccents, [preset.polyBeats], ACCENT_LEVELS],
  ];
  for (const [field, bytes, lengths, limit] of checks) {
    const reason = bytes && bytesProblem(bytes, lengths, limit);
    if (reason) return { field, reason };
  }
  return undefined;
}

export const isPolyAgainst = (value: number) =>
  value === POLY_AGAINST_BAR ||
  (Number.isInteger(value) &&
    value >= MIN_POLY_AGAINST &&
    value <= MAX_POLY_AGAINST);

export const normalizePolyAgainst = (against: number, beatsPerBar: number) =>
  isPolyAgainst(against) && against !== beatsPerBar
    ? against
    : POLY_AGAINST_BAR;

export function presetViolation(
  preset: PresetShape,
): RuleViolation | undefined {
  if (!DENOMINATORS.includes(preset.denominator))
    return {
      field: 'denominator',
      reason: `expected ${DENOMINATORS.join('/')}`,
    };
  const units: readonly number[] = Object.values(RAMP_UNITS);
  if (!units.includes(preset.rampUnit))
    return { field: 'rampUnit', reason: `expected ${units.join('/')}` };
  const step = preset.rampStep ?? MIN_RAMP_STEP;
  if (!(step >= MIN_RAMP_STEP && step <= MAX_STEP))
    return {
      field: 'rampStep',
      reason: `expected ${String(MIN_RAMP_STEP)}–${String(MAX_STEP)}`,
    };
  if (!isPolyAgainst(preset.polyAgainst ?? POLY_AGAINST_BAR))
    return {
      field: 'polyAgainst',
      reason: `expected ${String(POLY_AGAINST_BAR)} or ${String(MIN_POLY_AGAINST)}–${String(MAX_POLY_AGAINST)}`,
    };
  return boundViolation(preset) ?? blobViolation(preset);
}
