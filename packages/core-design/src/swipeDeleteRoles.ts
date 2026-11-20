import { fontFamily } from './tokens.ts';

export const swipeDelete = {
  swipeStartDp: 10,
  panel: 132,
  panelGap: 8,
  tintMix: 0.16,
} as const;

export const SWIPE_DELETE_FRACTION = 0.5;

export const swipeDeleteText = {
  label: { family: fontFamily.display, weight: 600, size: 14 },
  tintLabel: { family: fontFamily.display, weight: 500, size: 14 },
} as const;
