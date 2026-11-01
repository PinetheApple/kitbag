import type { SliderMode } from '@kitbag/core-design';
import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';

const PERCENT = 100;
const UNITY_VOLUME = 1;
const DETENT_REACH_OF_RANGE = 0.03;
const WARN_ABOVE_VOLUME = 1.5;
const ACCESSIBILITY_STEP_PERCENT = 1;

const VOLUME_MODE: SliderMode = 'seek';

export const VOLUME_SLIDER = {
  mode: VOLUME_MODE,
  detent: {
    at: UNITY_VOLUME / KB_VOLUME_BOUNDS.max,
    reach: DETENT_REACH_OF_RANGE,
  },
  warnAbove: WARN_ABOVE_VOLUME / KB_VOLUME_BOUNDS.max,
  step: ACCESSIBILITY_STEP_PERCENT / PERCENT / KB_VOLUME_BOUNDS.max,
} as const;

export function volumeOfFraction(fraction: number): number {
  return fraction * KB_VOLUME_BOUNDS.max;
}

export function fractionOfVolume(volume: number): number {
  return volume / KB_VOLUME_BOUNDS.max;
}

export function volumePercent(volume: number): string {
  return `${String(Math.round(volume * PERCENT))}%`;
}
