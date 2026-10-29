export const MIN_BEATS = 1;

export interface Meter {
  readonly beats: number;
  readonly denominator: number;
}

const MOCKUP_COMMON_METERS: readonly Meter[] = [
  { beats: 2, denominator: 4 },
  { beats: 3, denominator: 4 },
  { beats: 4, denominator: 4 },
  { beats: 5, denominator: 4 },
  { beats: 6, denominator: 8 },
  { beats: 7, denominator: 8 },
  { beats: 9, denominator: 8 },
  { beats: 12, denominator: 8 },
];

export function numeratorChoices(maxBeats: number): readonly number[] {
  return Array.from(
    { length: Math.max(maxBeats - MIN_BEATS + 1, 0) },
    (_unused, i) => MIN_BEATS + i,
  );
}

export function commonMeters(
  maxBeats: number,
  denominators: readonly number[],
): readonly Meter[] {
  return MOCKUP_COMMON_METERS.filter(
    (meter) =>
      meter.beats <= maxBeats && denominators.includes(meter.denominator),
  );
}

export function meterLabel(meter: Meter): string {
  return `${String(meter.beats)}/${String(meter.denominator)}`;
}

export function spokenMeter(meter: Meter): string {
  return `${String(meter.beats)} over ${String(meter.denominator)}`;
}

export function sameMeter(a: Meter, b: Meter): boolean {
  return a.beats === b.beats && a.denominator === b.denominator;
}
