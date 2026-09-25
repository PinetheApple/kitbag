// core-db may not import core-native (§13.1), so these mirror metronome.h and
// kitbag_api.h; engine-limits.test.ts fails if either side drifts.
export const MIN_BPM = 20;
export const MAX_BPM = 400;
export const MAX_BEATS = 16;
export const MAX_POLY_BEATS = 16;
export const MAX_SUBDIVISION = 16;
export const MAX_RAMP_BARS = 64;
export const MAX_MUTE_BARS = 16;
export const DEFAULT_DENOMINATOR = 4;
const MIN_DENOMINATOR = 2;
const MAX_DENOMINATOR = 16;
export const DENOMINATORS: readonly number[] = Array.from(
  { length: Math.log2(MAX_DENOMINATOR / MIN_DENOMINATOR) + 1 },
  (_, step) => MIN_DENOMINATOR * 2 ** step,
);
export const SOUND_COUNT = 6;
export const ACCENT_LEVELS = 3;
export const PER_ACCENT_SOUND_BYTES = 2;

export interface PresetShape {
  bpm: number;
  subdivision: number;
  rampStartBpm: number | null;
  rampEndBpm: number | null;
  rampBars: number | null;
  barMutePlayBars: number | null;
  barMuteMuteBars: number | null;
  beatsPerBar: number;
  denominator: number;
  sound: number;
  polyBeats: number;
  accents: Uint8Array;
  perAccentSounds: Uint8Array | null;
  polyAccents: Uint8Array | null;
}

export interface RuleViolation {
  field: keyof PresetShape;
  reason: string;
}

const within = (value: number, low: number, high: number) =>
  Number.isInteger(value) && value >= low && value <= high;

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

const optional = (value: number | null, low: number, high: number) =>
  value === null || (value >= low && value <= high && Number.isFinite(value));

const range = (low: number, high: number) => ({
  low,
  high,
  reason: `expected ${String(low)}–${String(high)}`,
});

const TRAINER_RANGES = {
  rampStartBpm: range(MIN_BPM, MAX_BPM),
  rampEndBpm: range(MIN_BPM, MAX_BPM),
  rampBars: range(1, MAX_RAMP_BARS),
  barMutePlayBars: range(1, MAX_MUTE_BARS),
  barMuteMuteBars: range(1, MAX_MUTE_BARS),
} as const;

function trainerViolation(preset: PresetShape): RuleViolation | undefined {
  for (const [field, { low, high, reason }] of Object.entries(TRAINER_RANGES)) {
    const key = field as keyof typeof TRAINER_RANGES;
    if (!optional(preset[key], low, high)) return { field: key, reason };
  }
  return undefined;
}

function scalarViolation(preset: PresetShape): RuleViolation | undefined {
  if (!(preset.bpm >= MIN_BPM && preset.bpm <= MAX_BPM))
    return {
      field: 'bpm',
      reason: `expected ${String(MIN_BPM)}–${String(MAX_BPM)}`,
    };
  if (!within(preset.beatsPerBar, 1, MAX_BEATS))
    return { field: 'beatsPerBar', reason: `expected 1–${String(MAX_BEATS)}` };
  if (!within(preset.subdivision, 1, MAX_SUBDIVISION))
    return {
      field: 'subdivision',
      reason: `expected 1–${String(MAX_SUBDIVISION)}`,
    };
  if (!DENOMINATORS.includes(preset.denominator))
    return {
      field: 'denominator',
      reason: `expected ${DENOMINATORS.join('/')}`,
    };
  if (!within(preset.sound, 0, SOUND_COUNT - 1))
    return { field: 'sound', reason: 'expected an engine sound id' };
  if (!within(preset.polyBeats, 0, MAX_POLY_BEATS))
    return {
      field: 'polyBeats',
      reason: `expected 0–${String(MAX_POLY_BEATS)}`,
    };
  return undefined;
}

export function presetViolation(
  preset: PresetShape,
): RuleViolation | undefined {
  const scalar = scalarViolation(preset) ?? trainerViolation(preset);
  if (scalar) return scalar;
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
