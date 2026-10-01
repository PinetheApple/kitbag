import { KB_COUNT_IN_BARS, type KbCountInBars } from '@kitbag/core-native';

const OFF = 0;

export const COUNT_IN_MODE = { distinct: 'distinct', same: 'same' } as const;
export type CountInMode = (typeof COUNT_IN_MODE)[keyof typeof COUNT_IN_MODE];

export const COUNT_IN_MODE_OPTIONS = [
  { value: COUNT_IN_MODE.distinct, label: 'Distinct' },
  { value: COUNT_IN_MODE.same, label: 'Same' },
] as const;

export function countInLabel(bars: KbCountInBars): string {
  if (bars === OFF) return 'Off';
  return `${String(bars)} ${bars === 1 ? 'bar' : 'bars'}`;
}

export const COUNT_IN_BAR_OPTIONS = KB_COUNT_IN_BARS.map((bars) => ({
  value: String(bars),
  label: countInLabel(bars),
}));

export function countInBarsFromOption(option: string): KbCountInBars {
  return KB_COUNT_IN_BARS.find((bars) => String(bars) === option) ?? OFF;
}

export function countInActive(bars: KbCountInBars): boolean {
  return bars !== OFF;
}
