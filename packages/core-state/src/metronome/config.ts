import {
  KB_ACCENT,
  KB_COUNT_IN_BARS,
  KB_MAX_RAMP_BARS,
  KB_RAMP_SECONDS_BOUNDS,
  KB_RAMP_UNIT,
  KB_SOUND_NAMES,
  type KbCountInBars,
} from '@kitbag/core-native';

const BPM_MIN = 20;
const BPM_MAX = 400;
const SECONDS_PER_MINUTE = 60;
const MIN_RAMP_BARS = 1;

/** The §5.2 BPM range; a screen reads this bound instead of retyping it. */
export const BPM_BOUNDS = { min: BPM_MIN, max: BPM_MAX } as const;

export interface RampConfig {
  readonly enabled: boolean;
  readonly startBpm: number;
  readonly endBpm: number;
  readonly duration: number;
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

// §5.2: tap a beat to cycle accent → normal → mute → accent.
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

function clampDuration(duration: number, unit: KB_RAMP_UNIT): number {
  if (unit === KB_RAMP_UNIT.KB_RAMP_BARS) {
    return clamp(Math.round(duration), MIN_RAMP_BARS, KB_MAX_RAMP_BARS);
  }
  const scale = unit === KB_RAMP_UNIT.KB_RAMP_MINUTES ? SECONDS_PER_MINUTE : 1;
  return clamp(
    duration,
    KB_RAMP_SECONDS_BOUNDS.min / scale,
    KB_RAMP_SECONDS_BOUNDS.max / scale,
  );
}

/** The ramp as the engine will hold it, or undefined where it keeps the old one. */
export function normalizeRamp(config: RampConfig): RampConfig | undefined {
  if (!config.enabled) return config;
  const finite = [config.startBpm, config.endBpm, config.duration].every(
    Number.isFinite,
  );
  const units: readonly number[] = Object.values(KB_RAMP_UNIT);
  if (!finite || !units.includes(config.unit)) return undefined;
  return {
    ...config,
    startBpm: clamp(config.startBpm, BPM_MIN, BPM_MAX),
    endBpm: clamp(config.endBpm, BPM_MIN, BPM_MAX),
    duration: clampDuration(config.duration, config.unit),
  };
}
