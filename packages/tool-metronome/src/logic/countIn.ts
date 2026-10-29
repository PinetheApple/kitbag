import { countLabel } from '@kitbag/core-design';
import {
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  type KbCountInBars,
} from '@kitbag/core-native';

const OFF_LABEL = 'Off';

export const COUNT_IN_MODE = { distinct: 'distinct', same: 'same' } as const;
export type CountInMode = (typeof COUNT_IN_MODE)[keyof typeof COUNT_IN_MODE];

export const COUNT_IN_MODE_OPTIONS = [
  { value: COUNT_IN_MODE.same, label: 'Same' },
  { value: COUNT_IN_MODE.distinct, label: 'Distinct' },
] as const;

export function countInMode(distinct: boolean): CountInMode {
  return distinct ? COUNT_IN_MODE.distinct : COUNT_IN_MODE.same;
}

export function countInLabel(bars: KbCountInBars): string {
  if (bars === KB_COUNT_IN_OFF) return OFF_LABEL;
  return countLabel(bars, 'bar', 'bars');
}

export const COUNT_IN_BAR_OPTIONS = KB_COUNT_IN_BARS.map((bars) => ({
  value: String(bars),
  label: countInLabel(bars),
}));

export const COUNT_IN_SEGMENT_OPTIONS = KB_COUNT_IN_BARS.map((bars) => ({
  value: String(bars),
  label: bars === KB_COUNT_IN_OFF ? OFF_LABEL : String(bars),
  accessibilityLabel: countInLabel(bars),
}));

export function countInBarsFromOption(option: string): KbCountInBars {
  return (
    KB_COUNT_IN_BARS.find((bars) => String(bars) === option) ?? KB_COUNT_IN_OFF
  );
}
