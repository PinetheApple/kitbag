const BASE_UNIT = 'B';
const LARGER_UNITS = ['KB', 'MB', 'GB'] as const;
// SI units, as Android's own storage screens count them.
const BYTES_PER_UNIT = 1000;
const WHOLE_FROM = 10;
const SHOWN_DECIMALS = 1;

type ByteUnit = typeof BASE_UNIT | (typeof LARGER_UNITS)[number];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit: ByteUnit = BASE_UNIT;
  for (const larger of LARGER_UNITS) {
    if (Math.round(value) < BYTES_PER_UNIT) break;
    value /= BYTES_PER_UNIT;
    unit = larger;
  }
  const decimal = value.toFixed(SHOWN_DECIMALS);
  const shown =
    unit === BASE_UNIT || Number(decimal) >= WHOLE_FROM
      ? String(Math.round(value))
      : decimal;
  return `${shown} ${unit}`;
}
