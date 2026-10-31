import { fontFamily } from './tokens.ts';

export const SNACKBAR_DURATION_MS = 6000;

export const snackbar = {
  minHeight: 48,
  radius: 12,
  sideInset: 12,
  textLeft: 16,
  actionRight: 6,
  gap: 12,
  actionHeight: 40,
  actionH: 12,
  dividerMix: 0.3,
} as const;

export const snackbarText = {
  message: { family: fontFamily.body, weight: 400, size: 13.5 },
  action: { family: fontFamily.display, weight: 700, size: 14, tracking: 0.04 },
} as const;
