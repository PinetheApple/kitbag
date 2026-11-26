import { fontFamily } from './tokens.ts';

export const stepper = {
  height: 48,
  radius: 10,
  inset: 2,
  gap: 2,
  value: 52,
  key: 44,
} as const;

export const stepperText = {
  value: { family: fontFamily.display, weight: 500, size: 14, tabular: true },
} as const;
