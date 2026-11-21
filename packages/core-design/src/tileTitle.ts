import type { TextStyle } from 'react-native';

import { fittedStyle, UNMEASURED_STYLE } from './oneLineFit.ts';
import { textRoles } from './roles.ts';

export type TitleFits = Readonly<Record<string, number>>;

export function sharedTitleSize(
  fits: TitleFits,
  ids: readonly string[],
): number | undefined {
  const sizes: number[] = [];
  for (const id of ids) {
    const size = fits[id];
    if (size === undefined) return undefined;
    sizes.push(size);
  }
  return Math.min(...sizes);
}

export function cappedTitleStyle(
  fitted: TextStyle,
  cap: number | undefined,
): TextStyle {
  if (fitted.fontSize === undefined || cap === undefined)
    return UNMEASURED_STYLE;
  return cap >= fitted.fontSize
    ? fitted
    : fittedStyle(textRoles.tileTitle, cap);
}
