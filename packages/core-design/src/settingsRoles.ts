import { fontFamily, type TypeRole } from './tokens.ts';

export const optionRow = {
  padH: 11,
  gap: 9,
} as const;

export const optionRowText = {
  title: { family: fontFamily.display, weight: 500, size: 13 },
  meta: { family: fontFamily.body, weight: 400, size: 11 },
} as const satisfies Record<string, TypeRole>;

export const calibration = {
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

export const toolsManager = {
  introH: 2,
  noteV: 10,
  noteH: 12,
  pointIconTop: 3,
} as const;

export const toolsManagerText = {
  headline: { family: fontFamily.display, weight: 500, size: 22 },
} as const satisfies Record<string, TypeRole>;

export const dataFolder = {
  volumeRowMinHeight: 58,
  highlightEdge: 2,
  pathTop: 4,
  locationGap: 6,
  stripTop: 8,
  stripEnd: 4,
  stripBottom: 10,
  stripFixEnd: 12,
  stripProgress: 2,
  stripProgressBottom: -1,
} as const;

export const dataFolderType = {
  progress: {
    family: fontFamily.display,
    weight: 500,
    size: 13.5,
    tabular: true,
  },
  stripTitle: { family: fontFamily.display, weight: 500, size: 13.5 },
} as const satisfies Record<string, TypeRole>;
