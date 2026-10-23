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
  rampSteps,
  rampTotalLabel,
  stepRampInterval,
  withRampUnit,
} from './rampUnit.ts';

const draft: RampConfig = {
  enabled: false,
  startBpm: 96,
  targetBpm: 104,
  stepBpm: 5,
  interval: 8,
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

describe('ramp interval per unit', () => {
  it('clamps a bars ramp to the engine bar ceiling', () => {
    const stepped = stepRampInterval(
      { ...draft, interval: KB_MAX_RAMP_BARS },
      5,
    );
    expect(stepped.interval).toBe(KB_MAX_RAMP_BARS);
  });

  it('re-clamps the interval when the unit changes', () => {
    const long = { ...draft, interval: 90 };
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_SECONDS).interval).toBe(90);
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_MINUTES).interval).toBe(
      KB_RAMP_SECONDS_BOUNDS.max / 60,
    );
    expect(withRampUnit(long, KB_RAMP_UNIT.KB_RAMP_BARS).interval).toBe(
      KB_MAX_RAMP_BARS,
    );
  });

  it('keeps any length the store accepts, so the sheet and the store agree', () => {
    const half = {
      ...draft,
      interval: 0.5,
      unit: KB_RAMP_UNIT.KB_RAMP_MINUTES,
    };
    expect(withRampUnit(half, KB_RAMP_UNIT.KB_RAMP_MINUTES).interval).toBe(0.5);
    expect(
      withRampUnit({ ...half, interval: 0 }, KB_RAMP_UNIT.KB_RAMP_MINUTES)
        .interval,
    ).toBe(KB_RAMP_SECONDS_BOUNDS.min / 60);
  });

  it('steps in whole units and never steps below one', () => {
    const minute = {
      ...draft,
      interval: 1,
      unit: KB_RAMP_UNIT.KB_RAMP_MINUTES,
    };
    expect(stepRampInterval(minute, -1).interval).toBe(1);
    expect(stepRampInterval(minute, 1).interval).toBe(2);
  });
});

describe('stepped ramp totals', () => {
  const ramp = {
    enabled: true,
    startBpm: 100,
    targetBpm: 140,
    stepBpm: 5,
    interval: 4,
    unit: KB_RAMP_UNIT.KB_RAMP_BARS,
    loop: false,
  };

  it('counts the intervals to the target, the last step stopping on it', () => {
    expect(rampSteps(ramp)).toBe(8);
    expect(rampSteps({ ...ramp, stepBpm: 15 })).toBe(3);
    expect(rampSteps({ ...ramp, startBpm: 160, targetBpm: 120 })).toBe(8);
  });

  it('names the total time in the ramp unit', () => {
    expect(rampTotalLabel(ramp)).toBe('Reaches 140 BPM after 32 bars');
    expect(
      rampTotalLabel({
        ...ramp,
        interval: 20,
        unit: KB_RAMP_UNIT.KB_RAMP_SECONDS,
      }),
    ).toBe('Reaches 140 BPM after 160 seconds');
    expect(
      rampTotalLabel({ ...ramp, targetBpm: ramp.startBpm + 1, interval: 1 }),
    ).toMatch(/after 1 bar$/);
  });
});
