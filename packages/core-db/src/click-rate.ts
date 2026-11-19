export const CLICK_RATE = {
  single: 'single',
  double: 'double',
  half: 'half',
} as const;
export type ClickRate = (typeof CLICK_RATE)[keyof typeof CLICK_RATE];
export const CLICK_RATES = Object.values(CLICK_RATE) as [
  ClickRate,
  ...ClickRate[],
];
