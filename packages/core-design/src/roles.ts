import { fontFamily, ledRadius, radii, type TypeRole } from './tokens.ts';

export const space = {
  inlineKeyGap: 2,
  barPreviewGap: 3,
  segmentInset: 3,
  chipGap: 6,
  stepKeyGap: 7,
  controlGap: 8,
  ledGap: 9,
  rowGap: 10,
  sectionGap: 12,
  screenInset: 16,
  cardPadding: 14,
  ledGroupGap: 18,
  transportGap: 22,
} as const;

export const size = {
  stroke: 1,
  ledMain: 26,
  ledMainBorder: 2,
  ledSmall: 16,
  ledSmallBorder: 1.5,
  stepKey: 24,
  stepValueMinWidth: 40,
  transportKey: 42,
  playButton: 58,
  playGlyphBox: 22,
  grabWidth: 36,
  grabHeight: 4,
  liveDot: 7,
  sweepTrack: 3,
  barPreview: 18,
} as const;

export const radius = {
  ...radii,
  circle: ledRadius,
  badge: 6,
  stepKey: 7,
  stepInline: 9,
  barPreview: 3,
  stepInlineKey: 6,
  segment: 11,
  segmentOption: 8,
  preset: 11,
  numpadKey: 11,
  tempoZone: 18,
  sweepTrack: 2,
} as const;

export const inset = {
  appBar: 2,
  buttonV: 10,
  buttonH: 18,
  chipV: 5,
  chipH: 12,
  badgeV: 2,
  badgeH: 7,
  presetV: 9,
  numpadKeyV: 13,
  segmentOptionV: 6,
  segmentOptionH: 4,
  stepInlineV: 3,
  stepInlineH: 4,
  stepInlineKeyV: 2,
  stepInlineKeyH: 7,
  tempoZoneTop: 26,
  tempoZoneBottom: 18,
  sweepH: 18,
} as const;

export const opacity = {
  muted: 0.4,
  barPreviewSounding: 0.85,
} as const;

export const mix = {
  activeControl: 0.18,
  activeCard: 0.07,
  badgeBorder: 0.4,
  tempoZoneGlow: 0.05,
  cardBorder: 0.35,
} as const;

export const presetActionGrow = 1.3;

export const playGlyphPath = {
  viewBox: 20,
  left: 6,
  top: 4,
  width: 10,
  height: 12,
} as const;

const display = fontFamily.display;
const body = fontFamily.body;

export const textRoles = {
  appBarTitle: { family: display, weight: 500, size: 17 },
  button: { family: display, weight: 500, size: 14 },
  presetAction: { family: display, weight: 700, size: 14 },
  preset: { family: display, weight: 500, size: 13.5, tabular: true },
  chip: { family: display, weight: 400, size: 12.5 },
  chipValue: { family: display, weight: 500, size: 12.5, tabular: true },
  chipAside: { family: display, weight: 400, size: 11 },
  tempoCaption: { family: display, weight: 400, size: 11, tracking: 0.22 },
  segment: { family: display, weight: 400, size: 12.5 },
  badge: { family: display, weight: 400, size: 10.5, tracking: 0.06 },
  stepKey: { family: display, weight: 400, size: 14 },
  stepInline: { family: display, weight: 400, size: 12.5 },
  stepInlineValue: { family: display, weight: 500, size: 12.5, tabular: true },
  transportKey: { family: display, weight: 400, size: 11 },
  sheetTitle: { family: display, weight: 500, size: 14 },
  sheetNumeral: {
    family: display,
    weight: 700,
    size: 52,
    tracking: -0.03,
    tabular: true,
  },
  numpadKey: { family: display, weight: 400, size: 19, tabular: true },
  hint: { family: body, weight: 400, size: 11.5 },
  fieldLabel: { family: body, weight: 400, size: 13.5 },
} as const satisfies Record<string, TypeRole>;

export type TextRoleName = keyof typeof textRoles;

export const appBarTitleMinSize = 15;

export const iconSizes = {
  chip: 12.5,
  chevron: 13,
  control: 14,
  action: 16,
  title: 17,
} as const;

export type IconSize = keyof typeof iconSizes;
