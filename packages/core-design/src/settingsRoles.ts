import { fontFamily, type TypeRole } from './tokens.ts';

export const calibration = {
  routeRowH: 11,
  routeRowGap: 9,
  tapZoneV: 20,
  tapPromptV: 26,
  tapPromptH: 14,
  scatterHeight: 52,
  meanLine: 2,
  dot: 5,
  axisSide: 6,
  axisBottom: 3,
} as const;

export const rig = {
  sliderWidth: 96,
  readoutWidth: 42,
  accentLedsV: 6,
  accentPreviewWidth: 146,
} as const;

export const calibrationText = {
  routeName: { family: fontFamily.display, weight: 500, size: 13 },
  routeMeta: { family: fontFamily.body, weight: 400, size: 11 },
  tapCount: {
    family: fontFamily.display,
    weight: 700,
    size: 60,
    tracking: -0.03,
    tabular: true,
  },
  tapCaption: {
    family: fontFamily.display,
    weight: 400,
    size: 11,
    tracking: 0.2,
  },
  tapPrompt: { family: fontFamily.display, weight: 500, size: 16 },
  scatterAxis: { family: fontFamily.display, weight: 400, size: 9.5 },
} as const satisfies Record<string, TypeRole>;
