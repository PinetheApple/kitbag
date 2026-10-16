import {
  KB_MAX_RAMP_BARS,
  KB_RAMP_SECONDS_BOUNDS,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import type { RampConfig } from '@kitbag/core-state';

import { barBounds, stepWithin, type BarBounds } from './trainer.ts';

const SECONDS_PER_MINUTE = 60;
const MIN_WHOLE_MINUTES = 1;

const UNIT_NAMES: Record<KB_RAMP_UNIT, { short: string; long: string }> = {
  [KB_RAMP_UNIT.KB_RAMP_BARS]: { short: 'bars', long: 'bars' },
  [KB_RAMP_UNIT.KB_RAMP_SECONDS]: { short: 'sec', long: 'seconds' },
  [KB_RAMP_UNIT.KB_RAMP_MINUTES]: { short: 'min', long: 'minutes' },
};

const UNITS = Object.values(KB_RAMP_UNIT);

export const RAMP_UNIT_OPTIONS = UNITS.map((unit) => ({
  value: String(unit),
  label: UNIT_NAMES[unit].short,
}));

export function rampUnitOption(unit: KB_RAMP_UNIT): string {
  return String(unit);
}

export function rampUnitFromOption(option: string): KB_RAMP_UNIT {
  return (
    UNITS.find((unit) => String(unit) === option) ?? KB_RAMP_UNIT.KB_RAMP_BARS
  );
}

export function rampUnitLabel(unit: KB_RAMP_UNIT): string {
  return UNIT_NAMES[unit].long;
}

export function rampDurationBounds(unit: KB_RAMP_UNIT): BarBounds {
  if (unit === KB_RAMP_UNIT.KB_RAMP_BARS) return barBounds(KB_MAX_RAMP_BARS);
  if (unit === KB_RAMP_UNIT.KB_RAMP_SECONDS) return KB_RAMP_SECONDS_BOUNDS;
  return {
    min: MIN_WHOLE_MINUTES,
    max: KB_RAMP_SECONDS_BOUNDS.max / SECONDS_PER_MINUTE,
  };
}

export function stepRampDuration(draft: RampConfig, delta: number): RampConfig {
  const bounds = rampDurationBounds(draft.unit);
  return { ...draft, duration: stepWithin(draft.duration, delta, bounds) };
}

export function withRampUnit(
  draft: RampConfig,
  unit: KB_RAMP_UNIT,
): RampConfig {
  return stepRampDuration({ ...draft, unit }, 0);
}
