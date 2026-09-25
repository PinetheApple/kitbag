import {
  ACCENT_LEVELS,
  DEFAULT_DENOMINATOR,
  DENOMINATORS,
  MAX_BEATS,
  MAX_BPM,
  MAX_MUTE_BARS,
  MAX_POLY_BEATS,
  MAX_RAMP_BARS,
  MAX_SUBDIVISION,
  MIN_BPM,
  PER_ACCENT_SOUND_BYTES,
  SOUND_COUNT,
} from './preset-rules';

const NORMAL_ACCENT = '01';
const HEX_RADIX = 16;

const hexCodes = (count: number) =>
  Array.from(
    { length: count },
    (_, code) => `'${code.toString(HEX_RADIX).padStart(2, '0').toUpperCase()}'`,
  ).join(', ');

const clamp = (column: string, low: number, high: number) =>
  `UPDATE song_presets SET ${column} = min(max(${column}, ${String(low)}), ${String(high)})`;

// Flutter read an unknown accent code as normal (legacy converters.dart);
// the repair keeps that meaning and pads or trims to the length column.
function repairCodes(column: string, lengthColumn: string): string {
  const byte = `hex(substr(song_presets.${column}, n, 1))`;
  return `UPDATE song_presets SET ${column} = (
    WITH RECURSIVE slot(n) AS (
      SELECT 1 UNION ALL SELECT n + 1 FROM slot WHERE n < song_presets.${lengthColumn}
    )
    SELECT unhex(group_concat(
      CASE WHEN ${byte} IN (${hexCodes(ACCENT_LEVELS)}) THEN ${byte} ELSE '${NORMAL_ACCENT}' END,
      '' ORDER BY n))
    FROM slot)
  WHERE ${column} IS NOT NULL AND ${lengthColumn} > 0`;
}

const perAccentSoundsInvalid = Array.from(
  { length: PER_ACCENT_SOUND_BYTES },
  (_, index) =>
    `hex(substr(per_accent_sounds, ${String(index + 1)}, 1)) NOT IN (${hexCodes(SOUND_COUNT)})`,
).join(' OR ');

export const REPAIR_PRESETS: readonly string[] = [
  clamp('bpm', MIN_BPM, MAX_BPM),
  clamp('beats_per_bar', 1, MAX_BEATS),
  clamp('subdivision', 1, MAX_SUBDIVISION),
  clamp('sound', 0, SOUND_COUNT - 1),
  clamp('poly_beats', 0, MAX_POLY_BEATS),
  clamp('ramp_start_bpm', MIN_BPM, MAX_BPM),
  clamp('ramp_end_bpm', MIN_BPM, MAX_BPM),
  clamp('ramp_bars', 1, MAX_RAMP_BARS),
  clamp('bar_mute_play_bars', 1, MAX_MUTE_BARS),
  clamp('bar_mute_mute_bars', 1, MAX_MUTE_BARS),
  `UPDATE song_presets SET denominator = ${String(DEFAULT_DENOMINATOR)}
    WHERE denominator NOT IN (${DENOMINATORS.join(', ')})`,
  repairCodes('accents', 'beats_per_bar'),
  'UPDATE song_presets SET poly_accents = NULL WHERE length(poly_accents) != poly_beats',
  repairCodes('poly_accents', 'poly_beats'),
  `UPDATE song_presets SET per_accent_sounds = NULL
    WHERE length(per_accent_sounds) NOT IN (0, ${String(PER_ACCENT_SOUND_BYTES)})
    OR (length(per_accent_sounds) > 0 AND (${perAccentSoundsInvalid}))`,
];
