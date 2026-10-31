import {
  KB_MIN_RAMP_STEP_BPM,
  KB_MUTE_BARS_BOUNDS,
  KB_POLY_AGAINST_BAR,
  KB_POLY_AGAINST_BOUNDS,
  KB_POLY_BEATS_BOUNDS,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  rampIntervalBounds,
  stepPolyAgainst,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  confirmEntry,
  openEntry,
  pressDigit,
  type NumpadEntry,
} from './numpad.ts';
import { polyAgainstLabel } from './polyRow.ts';
import {
  practiceEntry,
  RAMP_STEP_BOUNDS,
  withPracticeEntry,
  type PracticeField,
  type PracticeValues,
} from './practiceEntry.ts';

const VALUES: PracticeValues = {
  ramp: {
    enabled: true,
    startBpm: 100,
    targetBpm: 140,
    stepBpm: 4,
    interval: 4,
    unit: KB_RAMP_UNIT.KB_RAMP_BARS,
    loop: false,
  },
  barMute: { enabled: true, playBars: 2, muteBars: 2 },
  polyBeats: 3,
  polyAgainst: KB_POLY_AGAINST_BAR,
  beatsPerBar: 4,
};

function typeInto(
  field: PracticeField,
  digits: readonly number[],
  values: PracticeValues = VALUES,
): PracticeValues {
  const { bounds, value } = practiceEntry(field, values);
  const entry = digits.reduce<NumpadEntry>(
    (current, digit) => pressDigit(current, digit, bounds),
    openEntry(value),
  );
  const typed = confirmEntry(entry, bounds);
  return typed === undefined ? values : withPracticeEntry(values, field, typed);
}

describe('typing a practice value', () => {
  it('sets the ramp step, clamped to the engine step range', () => {
    expect(typeInto('stepBpm', [1, 0]).ramp.stepBpm).toBe(10);
    expect(typeInto('stepBpm', [0]).ramp.stepBpm).toBe(KB_MIN_RAMP_STEP_BPM);
    expect(typeInto('stepBpm', [9, 9, 9]).ramp.stepBpm).toBe(
      BPM_BOUNDS.max - BPM_BOUNDS.min,
    );
    expect(RAMP_STEP_BOUNDS.min).toBe(KB_MIN_RAMP_STEP_BPM);
  });

  it('sets the interval within the current unit', () => {
    const bars = rampIntervalBounds(KB_RAMP_UNIT.KB_RAMP_BARS);
    expect(typeInto('interval', [8]).ramp.interval).toBe(8);
    expect(typeInto('interval', [9, 9]).ramp.interval).toBe(bars.max);
    const seconds = {
      ...VALUES,
      ramp: { ...VALUES.ramp, unit: KB_RAMP_UNIT.KB_RAMP_SECONDS },
    };
    expect(typeInto('interval', [9, 9], seconds).ramp.interval).toBe(99);
    expect(practiceEntry('interval', seconds).unit).toBe('seconds');
    const minutes = {
      ...VALUES,
      ramp: { ...VALUES.ramp, unit: KB_RAMP_UNIT.KB_RAMP_MINUTES },
    };
    expect(typeInto('interval', [0], minutes).ramp.interval).toBe(1);
  });

  it('sets play and mute bars within the engine range', () => {
    expect(typeInto('playBars', [3]).barMute).toEqual({
      ...VALUES.barMute,
      playBars: 3,
    });
    expect(typeInto('muteBars', [9, 9]).barMute.muteBars).toBe(
      KB_MUTE_BARS_BOUNDS.max,
    );
    expect(typeInto('playBars', [0]).barMute.playBars).toBe(
      KB_MUTE_BARS_BOUNDS.min,
    );
  });

  it('sets the poly count within the engine range', () => {
    expect(typeInto('polyBeats', [5]).polyBeats).toBe(5);
    expect(typeInto('polyBeats', [1]).polyBeats).toBe(KB_POLY_BEATS_BOUNDS.min);
    expect(typeInto('polyBeats', [9, 9]).polyBeats).toBe(
      KB_POLY_BEATS_BOUNDS.max,
    );
  });

  it('types the against count within the engine range', () => {
    expect(practiceEntry('polyAgainst', VALUES).value).toBe(4);
    expect(typeInto('polyAgainst', [2]).polyAgainst).toBe(2);
    expect(typeInto('polyAgainst', [0]).polyAgainst).toBe(
      KB_POLY_AGAINST_BOUNDS.min,
    );
    expect(typeInto('polyAgainst', [9, 9]).polyAgainst).toBe(
      KB_POLY_AGAINST_BOUNDS.max,
    );
  });

  it('agrees with the stepper: typing the bar count reads as the bar', () => {
    const three = { ...VALUES, polyAgainst: 3 };
    const typed = typeInto('polyAgainst', [4], three).polyAgainst;
    expect(typed).toBe(KB_POLY_AGAINST_BAR);
    expect(typed).toBe(stepPolyAgainst(3, 1, VALUES.beatsPerBar));
    expect(polyAgainstLabel(typed, VALUES.beatsPerBar)).toEqual({
      value: '4',
      suffix: 'bar',
    });
  });

  it('keeps the bar when the bar count is confirmed unchanged', () => {
    expect(typeInto('polyAgainst', [4]).polyAgainst).toBe(KB_POLY_AGAINST_BAR);
  });

  it('titles the poly count against the cycle it plays over', () => {
    expect(
      practiceEntry('polyBeats', { ...VALUES, polyAgainst: 2 }).title,
    ).toBe('Poly against 2');
  });

  it('titles each entry so a screen reader can tell them apart', () => {
    const fields: PracticeField[] = [
      'startBpm',
      'targetBpm',
      'stepBpm',
      'interval',
      'playBars',
      'muteBars',
      'polyBeats',
      'polyAgainst',
    ];
    const titles = fields.map((field) => practiceEntry(field, VALUES).title);
    expect(titles).toEqual([
      'Ramp from',
      'Ramp to',
      'Ramp step',
      'Ramp every',
      'Play bars',
      'Mute bars',
      'Poly against 4',
      'Against',
    ]);
  });
});
