import { clampUnit } from '@kitbag/core-design';
import { KB_MIXER_GAIN_BOUNDS } from '@kitbag/core-native';
import { MINUS, UNITY_GAIN } from '@kitbag/core-state';

// Amplitude follows the cube of the travel: about 60 dB of usable range with
// unity at about four fifths, the usual fader feel (SPEC §7.2).
const TAPER_EXPONENT = 3;
const DB_PER_DECADE = 20;
const DB_DISPLAY_TENTHS = 10;
// Quieter than this the level chip reads −∞, which also bounds its width.
const DISPLAY_FLOOR_DB = -60;

export function fractionToGain(fraction: number): number {
  return KB_MIXER_GAIN_BOUNDS.max * clampUnit(fraction) ** TAPER_EXPONENT;
}

export function gainToFraction(gain: number): number {
  const ratio =
    Math.max(gain, KB_MIXER_GAIN_BOUNDS.min) / KB_MIXER_GAIN_BOUNDS.max;
  return clampUnit(ratio ** (1 / TAPER_EXPONENT));
}

function gainToDb(gain: number): number {
  return DB_PER_DECADE * Math.log10(gain);
}

function dbNumber(gain: number): string {
  if (gain <= KB_MIXER_GAIN_BOUNDS.min) return `${MINUS}∞`;
  const db = Math.round(gainToDb(gain) * DB_DISPLAY_TENTHS) / DB_DISPLAY_TENTHS;
  if (db <= DISPLAY_FLOOR_DB) return `${MINUS}∞`;
  if (db === 0) return '0';
  return `${db < 0 ? MINUS : '+'}${String(Math.abs(db))}`;
}

export function formatDb(gain: number): string {
  return `${dbNumber(gain)} dB`;
}

export function isUnity(gain: number): boolean {
  return dbNumber(gain) === dbNumber(UNITY_GAIN);
}

// With tabular numerals every digit is as wide as 0, so this is the widest
// label the floor allows.
export const WIDEST_DB_LABEL = `${MINUS}00.0 dB`;

export const UNITY_FRACTION = gainToFraction(UNITY_GAIN);

export const FADER_ENDS = {
  low: dbNumber(KB_MIXER_GAIN_BOUNDS.min),
  high: dbNumber(KB_MIXER_GAIN_BOUNDS.max),
} as const;
