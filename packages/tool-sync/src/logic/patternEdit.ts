import type { KB_ACCENT } from '@kitbag/core-native';
import { cycleAccentValue } from '@kitbag/core-state';

export function cycledAccents(
  accents: readonly KB_ACCENT[],
  beat: number,
): readonly KB_ACCENT[] {
  return accents.map((accent, index) =>
    index === beat ? cycleAccentValue(accent) : accent,
  );
}
