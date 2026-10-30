import { clampUnit } from '@kitbag/core-design';
import { KB_RAMP_UNIT } from '@kitbag/core-native';

import { TENTHS } from './statusRows.ts';

const WHOLE_UNITS = 1;

// Reduced motion steps the bar when the countdown text ticks, never in between.
export function rampProgressFill(
  progress: number,
  interval: number,
  unit: KB_RAMP_UNIT,
  reduceMotion: boolean,
): number {
  'worklet';
  const fill = clampUnit(progress);
  if (!reduceMotion) return fill;
  const perUnit = unit === KB_RAMP_UNIT.KB_RAMP_MINUTES ? TENTHS : WHOLE_UNITS;
  const steps = interval * perUnit;
  return Math.floor(fill * steps) / steps;
}
