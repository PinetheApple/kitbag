import {
  KB_MAX_RAMP_BARS,
  KB_RAMP_SECONDS_BOUNDS,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import type { RampConfig } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  RAMP_UNIT_OPTIONS,
  rampUnitFromOption,
  rampUnitLabel,
  rampUnitOption,
  stepRampDuration,
  withRampUnit,
} from './rampUnit.ts';

const draft: RampConfig = {
  enabled: false,
  startBpm: 96,
  endBpm: 104,
  duration: 8,
  unit: KB_RAMP_UNIT.KB_RAMP_BARS,
  loop: false,
};

describe('ramp unit segment', () => {
  it('offers bars, sec, min in engine order and round-trips each unit', () => {
    expect(RAMP_UNIT_OPTIONS.map((o) => o.label)).toEqual([
      'bars',
      'sec',
      'min',
    ]);
    for (const unit of Object.values(KB_RAMP_UNIT)) {
      expect(rampUnitFromOption(rampUnitOption(unit))).toBe(unit);
    }
    expect(rampUnitLabel(KB_RAMP_UNIT.KB_RAMP_MINUTES)).toBe('minutes');
  });
});

describe('ramp duration per unit', () => {
  it('clamps a bars ramp to the engine bar ceiling', () => {
    const stepped = stepRampDuration(
      { ...draft, duration: KB_MAX_RAMP_BARS },
      5,
    );
    expect(stepped.duration).toBe(KB_MAX_RAMP_BARS);
  });

  it('re-clamps the duration when the unit changes', () => {
    const long = { ...draft, duration: 90 };
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_SECONDS).duration).toBe(90);
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_MINUTES).duration).toBe(
      KB_RAMP_SECONDS_BOUNDS.max / 60,
    );
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_BARS).duration).toBe(
      KB_MAX_RAMP_BARS,
    );
  });
});
