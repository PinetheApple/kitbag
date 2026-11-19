import { fontFamily, type TypeRole } from './tokens.ts';

export const databaseError = {
  screenV: 24,
  actionsTop: 4,
  hintLine: 1.45,
  snackbarAboveNav: 18,
} as const;

export const databaseErrorText = {
  hint: { family: fontFamily.body, weight: 400, size: 12 },
} as const satisfies Record<string, TypeRole>;
