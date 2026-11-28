const BASE_UNIT = 'B';
const LARGER_UNITS = ['KB', 'MB', 'GB'] as const;
// SI units, as Android's own storage screens count them.
const BYTES_PER_UNIT = 1000;
const WHOLE_FROM = 10;
const SHOWN_DECIMALS = 1;

type ByteUnit = typeof BASE_UNIT | (typeof LARGER_UNITS)[number];

const GIGABYTE_UNIT = 'GB' satisfies ByteUnit;
const GIGABYTE = BYTES_PER_UNIT ** (LARGER_UNITS.indexOf(GIGABYTE_UNIT) + 1);

interface Scale {
  readonly unit: ByteUnit;
  readonly divisor: number;
}

function scaleOf(bytes: number): Scale {
  let value = bytes;
  let scale: Scale = { unit: BASE_UNIT, divisor: 1 };
  for (const larger of LARGER_UNITS) {
    if (Math.round(value) < BYTES_PER_UNIT) break;
    value /= BYTES_PER_UNIT;
    scale = { unit: larger, divisor: scale.divisor * BYTES_PER_UNIT };
  }
  return scale;
}

function shown(bytes: number, { unit, divisor }: Scale): string {
  const value = bytes / divisor;
  const decimal = value.toFixed(SHOWN_DECIMALS);
  return unit === BASE_UNIT || Number(decimal) >= WHOLE_FROM
    ? String(Math.round(value))
    : decimal;
}

export function formatBytes(bytes: number): string {
  const scale = scaleOf(bytes);
  return `${shown(bytes, scale)} ${scale.unit}`;
}

export function formatBytesOf(part: number, whole: number): string {
  const scale = scaleOf(whole);
  return `${shown(part, scale)} of ${shown(whole, scale)} ${scale.unit}`;
}

export function formatWithGbDecimal(bytes: number): string {
  if (bytes < GIGABYTE) return formatBytes(bytes);
  return `${(bytes / GIGABYTE).toFixed(SHOWN_DECIMALS)} ${GIGABYTE_UNIT}`;
}
