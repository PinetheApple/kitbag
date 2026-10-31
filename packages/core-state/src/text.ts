export const MINUS = '−';

export const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const TWO_DIGITS = 2;

export interface ClockParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export function clockParts(totalSeconds: number): ClockParts {
  'worklet';
  const whole = Math.max(0, Math.floor(totalSeconds));
  const totalMinutes = Math.floor(whole / SECONDS_PER_MINUTE);
  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
    seconds: whole % SECONDS_PER_MINUTE,
  };
}

function pad(value: number): string {
  'worklet';
  return String(value).padStart(TWO_DIGITS, '0');
}

export function formatClockSeconds(totalSeconds: number): string {
  'worklet';
  const { hours, minutes, seconds } = clockParts(totalSeconds);
  if (hours === 0) return `${String(minutes)}:${pad(seconds)}`;
  return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
