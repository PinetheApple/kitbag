import { fontFamily } from './tokens.ts';

export const tapPad = {
  minHeight: 180,
  radius: 20,
  border: 2,
  gap: 8,
  badgeGap: 6,
} as const;

export const tapPadMix = { fill: 0.14 } as const;

export const tapPadText = {
  title: { family: fontFamily.display, weight: 600, size: 19 },
  hint: { family: fontFamily.body, weight: 400, size: 13.5 },
} as const;
