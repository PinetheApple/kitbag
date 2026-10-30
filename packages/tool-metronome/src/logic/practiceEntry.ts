import {
  KB_MIN_RAMP_STEP_BPM,
  KB_MUTE_BARS_BOUNDS,
  KB_POLY_BEATS_BOUNDS,
  type KB_RAMP_UNIT,
} from '@kitbag/core-native';
import {
  BPM_BOUNDS,
  rampIntervalBounds,
  type BarMuteConfig,
  type RampConfig,
} from '@kitbag/core-state';

import type { BpmBounds } from './bpmBounds.ts';
import { RAMP_BPM_ENTRY, withRampBpm, type RampBpmField } from './rampEntry.ts';
import { rampUnitLabel } from './rampUnit.ts';

export type PracticeField =
  RampBpmField | 'stepBpm' | 'interval' | 'playBars' | 'muteBars' | 'polyBeats';

export const RAMP_STEP_BOUNDS: BpmBounds = {
  min: KB_MIN_RAMP_STEP_BPM,
  max: BPM_BOUNDS.max - BPM_BOUNDS.min,
};

export interface PracticeValues {
  readonly ramp: RampConfig;
  readonly barMute: BarMuteConfig;
  readonly polyBeats: number;
  readonly beatsPerBar: number;
}

export interface PracticeEntry {
  readonly title: string;
  readonly confirm: string;
  readonly unit: string;
  readonly bounds: BpmBounds;
  readonly value: number;
}

export function wholeIntervalBounds(unit: KB_RAMP_UNIT): BpmBounds {
  const { min, max } = rampIntervalBounds(unit);
  return { min: Math.ceil(min), max: Math.floor(max) };
}

export function practiceEntry(
  field: PracticeField,
  values: PracticeValues,
): PracticeEntry {
  const { ramp, barMute } = values;
  switch (field) {
    case 'startBpm':
    case 'targetBpm':
      return {
        ...RAMP_BPM_ENTRY[field],
        unit: 'BPM',
        bounds: BPM_BOUNDS,
        value: ramp[field],
      };
    case 'stepBpm':
      return {
        title: 'Ramp step',
        confirm: 'Set ramp step',
        unit: 'BPM per step',
        bounds: RAMP_STEP_BOUNDS,
        value: ramp.stepBpm,
      };
    case 'interval':
      return {
        title: 'Ramp every',
        confirm: 'Set ramp interval',
        unit: rampUnitLabel(ramp.unit),
        bounds: wholeIntervalBounds(ramp.unit),
        value: ramp.interval,
      };
    case 'playBars':
      return {
        title: 'Play bars',
        confirm: 'Set bars to play',
        unit: 'bars',
        bounds: KB_MUTE_BARS_BOUNDS,
        value: barMute.playBars,
      };
    case 'muteBars':
      return {
        title: 'Mute bars',
        confirm: 'Set bars to mute',
        unit: 'bars',
        bounds: KB_MUTE_BARS_BOUNDS,
        value: barMute.muteBars,
      };
    case 'polyBeats':
      return {
        title: `Poly against ${String(values.beatsPerBar)}`,
        confirm: 'Set poly count',
        unit: 'beats',
        bounds: KB_POLY_BEATS_BOUNDS,
        value: values.polyBeats,
      };
  }
}

export function withPracticeEntry(
  values: PracticeValues,
  field: PracticeField,
  typed: number,
): PracticeValues {
  const { ramp, barMute } = values;
  switch (field) {
    case 'startBpm':
    case 'targetBpm':
      return { ...values, ramp: withRampBpm(ramp, field, typed) };
    case 'stepBpm':
      return { ...values, ramp: { ...ramp, stepBpm: typed } };
    case 'interval':
      return { ...values, ramp: { ...ramp, interval: typed } };
    case 'playBars':
      return { ...values, barMute: { ...barMute, playBars: typed } };
    case 'muteBars':
      return { ...values, barMute: { ...barMute, muteBars: typed } };
    case 'polyBeats':
      return { ...values, polyBeats: typed };
  }
}
