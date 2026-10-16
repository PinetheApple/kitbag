// core-db may not import core-native (§13.1), so these mirror metronome.h and
// kitbag_api.h; engine-limits.test.ts fails if either side drifts.
export const MIN_BPM = 20;
export const MAX_BPM = 400;
export const MAX_BEATS = 16;
export const MAX_POLY_BEATS = 16;
export const MAX_SUBDIVISION = 16;
export const MAX_RAMP_BARS = 64;
export const MAX_MUTE_BARS = 16;
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
  rampStartBpm: number | null;
  rampEndBpm: number | null;
  rampBars: number | null;
  barMutePlayBars: number | null;
  barMuteMuteBars: number | null;
  accents: Uint8Array;
  perAccentSounds: Uint8Array | null;
  polyAccents: Uint8Array | null;
}

type NumericField = {
  [K in keyof PresetShape]: PresetShape[K] extends number | null ? K : never;
}[keyof PresetShape];

export interface PresetBound {
  field: NumericField;
  column: string;
  low: number;
  high: number;
  integer: boolean;
}

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
    field: 'rampBars',
    column: 'ramp_bars',
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

function boundViolation(preset: PresetShape): RuleViolation | undefined {
  const failed = PRESET_BOUNDS.find(
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
      SOUND_COUNT,
    ],
    ['polyAccents', preset.polyAccents, [preset.polyBeats], ACCENT_LEVELS],
  ];
  for (const [field, bytes, lengths, limit] of checks) {
    const reason = bytes && bytesProblem(bytes, lengths, limit);
    if (reason) return { field, reason };
  }
  return undefined;
}

export function presetViolation(
  preset: PresetShape,
): RuleViolation | undefined {
  if (!DENOMINATORS.includes(preset.denominator))
    return {
      field: 'denominator',
      reason: `expected ${DENOMINATORS.join('/')}`,
    };
  return boundViolation(preset) ?? blobViolation(preset);
}
