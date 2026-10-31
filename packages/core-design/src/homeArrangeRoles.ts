import { space } from './roles.ts';
import { fontFamily, type TypeRole } from './tokens.ts';

export const homeArrange = {
  appBarGap: 10,
  hintLine: 1.45,
  rowGap: space.controlGap,
  rowMinHeight: 52,
  rowRadius: 13,
  rowPadV: 4,
  rowPadEnd: 8,
  rowInnerGap: 8,
  handleWidth: 44,
  handleIcon: 22,
  rowIcon: 20,
  eyeBox: 40,
  eyeIcon: 20,
  sectionTop: 6,
  segmentInset: 2,
  segmentOptionV: 4,
  segmentOptionH: 7,
  liftScale: 1.02,
  dropBorder: 1.5,
  hiddenRowOpacity: 0.75,
  smallButtonV: 7,
  smallButtonH: 13,
} as const;

export const homeArrangeText = {
  name: { family: fontFamily.display, weight: 500, size: 14 },
  section: {
    family: fontFamily.display,
    weight: 500,
    size: 11,
    tracking: 0.18,
    uppercase: true,
  },
  hint: { family: fontFamily.body, weight: 400, size: 12 },
  segment: { family: fontFamily.display, weight: 400, size: 12 },
  smallButton: { family: fontFamily.display, weight: 500, size: 13.5 },
} as const satisfies Record<string, TypeRole>;
