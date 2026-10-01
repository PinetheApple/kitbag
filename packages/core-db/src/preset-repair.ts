import {
  ACCENT_LEVELS,
  DEFAULT_DENOMINATOR,
  DENOMINATORS,
  NORMAL_ACCENT,
  PER_ACCENT_SOUND_BYTES,
  PRESET_BOUNDS,
  SOUND_COUNT,
  type PresetBound,
} from './preset-rules';

const HEX_RADIX = 16;

const hexByte = (code: number) =>
  `'${code.toString(HEX_RADIX).padStart(2, '0').toUpperCase()}'`;

const hexCodes = (count: number) =>
  Array.from({ length: count }, (_, code) => hexByte(code)).join(', ');

function clamp({ column, low, high, integer }: PresetBound): string {
  const value = integer ? `round(${column})` : column;
  return `UPDATE song_presets SET ${column} = min(max(${value}, ${String(low)}), ${String(high)})`;
}

// Flutter read an unknown accent code as normal (legacy converters.dart);
// the repair keeps that meaning and pads or trims to the length column.
function repairCodes(column: string, lengthColumn: string): string {
  const byte = `hex(substr(song_presets.${column}, n, 1))`;
  return `UPDATE song_presets SET ${column} = (
    WITH RECURSIVE slot(n) AS (
      SELECT 1 UNION ALL SELECT n + 1 FROM slot WHERE n < song_presets.${lengthColumn}
    )
    SELECT unhex(group_concat(
      CASE WHEN ${byte} IN (${hexCodes(ACCENT_LEVELS)}) THEN ${byte} ELSE ${hexByte(NORMAL_ACCENT)} END,
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
  ...PRESET_BOUNDS.map(clamp),
  `UPDATE song_presets SET denominator = ${String(DEFAULT_DENOMINATOR)}
    WHERE denominator NOT IN (${DENOMINATORS.join(', ')})`,
  repairCodes('accents', 'beats_per_bar'),
  'UPDATE song_presets SET poly_accents = NULL WHERE length(poly_accents) != poly_beats',
  repairCodes('poly_accents', 'poly_beats'),
  `UPDATE song_presets SET per_accent_sounds = NULL
    WHERE length(per_accent_sounds) NOT IN (0, ${String(PER_ACCENT_SOUND_BYTES)})
    OR (length(per_accent_sounds) > 0 AND (${perAccentSoundsInvalid}))`,
];
