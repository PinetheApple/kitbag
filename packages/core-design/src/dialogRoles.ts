import { fontFamily } from './tokens.ts';

export const dialog = {
  margin: 24,
  radius: 20,
  top: 20,
  h: 20,
  bottom: 16,
  titleBottom: 8,
  bodyBottom: 6,
  bodyRatio: 1.45,
  actionsTop: 6,
  actionsGap: 8,
} as const;

export const dialogText = {
  title: { family: fontFamily.display, weight: 500, size: 18 },
  body: { family: fontFamily.body, weight: 400, size: 14 },
} as const;
