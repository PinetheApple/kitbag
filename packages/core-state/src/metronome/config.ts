import {
  KB_ACCENT,
  KB_BPM_BOUNDS,
  KB_COUNT_IN_BARS,
  KB_MAX_RAMP_BARS,
  KB_MIN_RAMP_BARS,
  KB_MIN_RAMP_STEP_BPM,
  KB_RAMP_SECONDS_BOUNDS,
  KB_RAMP_UNIT,
  KB_SOUND_NAMES,
  type KbCountInBars,
} from '@kitbag/core-native';

const SECONDS_PER_MINUTE = 60;

export const BPM_BOUNDS = KB_BPM_BOUNDS;

export interface RampConfig {
  readonly enabled: boolean;
  readonly startBpm: number;
  readonly targetBpm: number;
  readonly stepBpm: number;
  readonly interval: number;
  readonly unit: KB_RAMP_UNIT;
  readonly loop: boolean;
}

export interface PerAccentSounds {
  readonly normal: number;
  readonly accent: number;
}

export interface CountInConfig {
  readonly bars: KbCountInBars;
  readonly distinct: boolean;
  readonly sound: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isSoundId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < KB_SOUND_NAMES.length;
}

export function isCountInBars(bars: number): bars is KbCountInBars {
  return (KB_COUNT_IN_BARS as readonly number[]).includes(bars);
}

export function cycleAccentValue(accent: KB_ACCENT): KB_ACCENT {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED)
    return KB_ACCENT.KB_ACCENT_NORMAL;
  if (accent === KB_ACCENT.KB_ACCENT_NORMAL) return KB_ACCENT.KB_ACCENT_MUTED;
  return KB_ACCENT.KB_ACCENT_ACCENTED;
}

export function resizeAccents(
  prev: readonly KB_ACCENT[],
  count: number,
): KB_ACCENT[] {
  return Array.from(
    { length: count },
    (_, i) => prev[i] ?? KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

export function initialAccents(count: number): KB_ACCENT[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? KB_ACCENT.KB_ACCENT_ACCENTED : KB_ACCENT.KB_ACCENT_NORMAL,
  );
}

export interface RampIntervalBounds {
  readonly min: number;
  readonly max: number;
}

export function rampIntervalBounds(unit: KB_RAMP_UNIT): RampIntervalBounds {
  if (unit === KB_RAMP_UNIT.KB_RAMP_BARS) {
    return { min: KB_MIN_RAMP_BARS, max: KB_MAX_RAMP_BARS };
  }
  const scale = unit === KB_RAMP_UNIT.KB_RAMP_MINUTES ? SECONDS_PER_MINUTE : 1;
  return {
    min: KB_RAMP_SECONDS_BOUNDS.min / scale,
    max: KB_RAMP_SECONDS_BOUNDS.max / scale,
  };
}

export function clampRampInterval(
  interval: number,
  unit: KB_RAMP_UNIT,
): number {
  const { min, max } = rampIntervalBounds(unit);
  const whole = unit === KB_RAMP_UNIT.KB_RAMP_BARS;
  return clamp(whole ? Math.round(interval) : interval, min, max);
}

export function normalizeRamp(config: RampConfig): RampConfig | undefined {
  if (!config.enabled) return config;
  const finite = [
    config.startBpm,
    config.targetBpm,
    config.stepBpm,
    config.interval,
  ].every(Number.isFinite);
  const units: readonly number[] = Object.values(KB_RAMP_UNIT);
  if (!finite || config.stepBpm === 0 || !units.includes(config.unit))
    return undefined;
  return {
    ...config,
    startBpm: clamp(config.startBpm, KB_BPM_BOUNDS.min, KB_BPM_BOUNDS.max),
    targetBpm: clamp(config.targetBpm, KB_BPM_BOUNDS.min, KB_BPM_BOUNDS.max),
    stepBpm: clamp(
      Math.abs(config.stepBpm),
      KB_MIN_RAMP_STEP_BPM,
      KB_BPM_BOUNDS.max - KB_BPM_BOUNDS.min,
    ),
    interval: clampRampInterval(config.interval, config.unit),
  };
}
