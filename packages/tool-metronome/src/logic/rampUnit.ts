import { KB_RAMP_UNIT } from '@kitbag/core-native';
import {
  clampRampDuration,
  rampDurationBounds,
  type RampConfig,
} from '@kitbag/core-state';

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

export function stepRampDuration(draft: RampConfig, delta: number): RampConfig {
  const { min, max } = rampDurationBounds(draft.unit);
  const duration = Math.min(
    Math.max(draft.duration + delta, Math.ceil(min)),
    max,
  );
  return { ...draft, duration };
}

export function withRampUnit(
  draft: RampConfig,
  unit: KB_RAMP_UNIT,
): RampConfig {
  return { ...draft, unit, duration: clampRampDuration(draft.duration, unit) };
}
