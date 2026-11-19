const QUARTER_NOTE = 4;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const TENTHS = 10;
const TWO_DIGITS = 2;

export type MeterGridState = 'ready' | 'pending' | 'failed';

export const meterCopy = {
  title: 'Meter',
  beatsPerBar: 'Beats per bar',
  barOne: 'Bar 1',
  barOneHere: 'Bar 1 here',
  useDetected: 'Use detected',
  done: 'Done',
  overriddenBadge: 'YOURS',
  overriddenSuffix: 'yours',
  close: 'Close the meter sheet',
  pending: 'Available once the beat is found',
  barOneOverridden: 'Yours. Set with the playhead.',
} as const;

export interface MeterChoice {
  readonly meterBeatsPerBar: number | null;
  readonly barOneSeconds: number | null;
}

export function meterLabel(beatsPerBar: number): string {
  return `${String(beatsPerBar)}/${String(QUARTER_NOTE)}`;
}

function pad(value: number): string {
  'worklet';
  return String(value).padStart(TWO_DIGITS, '0');
}

export function tenthsClock(seconds: number): string {
  'worklet';
  const shown = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const tenths = Math.round(shown * TENTHS);
  const whole = Math.floor(tenths / TENTHS);
  const totalMinutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const rest = pad(whole % SECONDS_PER_MINUTE);
  const clock =
    hours === 0
      ? `${String(totalMinutes)}:${rest}`
      : `${String(hours)}:${pad(totalMinutes % MINUTES_PER_HOUR)}:${rest}`;
  return `${clock}.${String(tenths % TENTHS)}`;
}

export function isOverridden(choice: MeterChoice): boolean {
  return choice.meterBeatsPerBar !== null || choice.barOneSeconds !== null;
}

export function meterRowValue(
  beatsPerBar: number,
  overridden: boolean,
): string {
  const meter = meterLabel(beatsPerBar);
  return overridden ? `${meter} · ${meterCopy.overriddenSuffix}` : meter;
}

export function detectedHint(
  detectedMeter: number,
  detectedBarOneSeconds: number,
  overridden: boolean,
): string {
  const meter = `Detected: ${meterLabel(detectedMeter)}`;
  return overridden
    ? `${meter}, bar 1 at ${tenthsClock(detectedBarOneSeconds)}`
    : meter;
}

export function barOneLabel(seconds: number): string {
  return `${meterCopy.barOne} at ${tenthsClock(seconds)}`;
}

export function playheadDetail(seconds: number): string {
  'worklet';
  return `Playhead ${tenthsClock(seconds)}: its nearest beat becomes bar 1`;
}
