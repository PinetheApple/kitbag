import {
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  type KbCountInBars,
} from '@kitbag/core-native';

export function countInBarsFromOption(option: string): KbCountInBars {
  return (
    KB_COUNT_IN_BARS.find((bars) => String(bars) === option) ?? KB_COUNT_IN_OFF
  );
}
