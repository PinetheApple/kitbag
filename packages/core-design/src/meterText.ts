const QUARTER_NOTE = 4;
const SECONDS_PER_MINUTE = 60;
const TENTHS = 10;
const SECONDS_DIGITS = 2;

export type MeterGridState = 'ready' | 'pending' | 'failed';

export const METER_PENDING = 'Available once the beat is found';

export interface MeterChoice {
  readonly meterBeatsPerBar: number | null;
  readonly barOneSeconds: number | null;
}

export function meterLabel(beatsPerBar: number): string {
  return `${String(beatsPerBar)}/${String(QUARTER_NOTE)}`;
}

export function tenthsClock(seconds: number): string {
  'worklet';
  const tenths = Math.round(Math.max(0, seconds) * TENTHS);
  const whole = Math.floor(tenths / TENTHS);
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(SECONDS_DIGITS, '0');
  return `${String(minutes)}:${rest}.${String(tenths % TENTHS)}`;
}

export function isOverridden(choice: MeterChoice): boolean {
  return choice.meterBeatsPerBar !== null || choice.barOneSeconds !== null;
}

export function meterRowValue(
  beatsPerBar: number,
  overridden: boolean,
): string {
  const meter = meterLabel(beatsPerBar);
  return overridden ? `${meter} · yours` : meter;
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
  return `Bar 1 at ${tenthsClock(seconds)}`;
}

export const BAR_ONE_YOURS = 'Yours. Set with the playhead.';

export function playheadDetail(seconds: number): string {
  'worklet';
  return `Playhead ${tenthsClock(seconds)}: its nearest beat becomes bar 1`;
}
