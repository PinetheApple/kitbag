import { KB_RAMP_UNIT } from '@kitbag/core-native';
import {
  clampRampInterval,
  rampIntervalBounds,
  type RampConfig,
} from '@kitbag/core-state';

interface UnitName {
  short: string;
  long: string;
}

const UNIT_NAMES: Record<KB_RAMP_UNIT, UnitName> = {
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

export function stepRampInterval(draft: RampConfig, delta: number): RampConfig {
  const { min, max } = rampIntervalBounds(draft.unit);
  const interval = Math.min(
    Math.max(draft.interval + delta, Math.ceil(min)),
    max,
  );
  return { ...draft, interval };
}

export function withRampUnit(
  draft: RampConfig,
  unit: KB_RAMP_UNIT,
): RampConfig {
  return { ...draft, unit, interval: clampRampInterval(draft.interval, unit) };
}
