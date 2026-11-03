import { grownTextScale, isTextScaled } from './textScale.ts';

export interface OneLineFitInput {
  readonly available: number;
  readonly textWidth: number;
  readonly size: number;
  readonly floor: number;
}

export interface OneLineFit {
  readonly fontSize: number;
  readonly truncates: boolean;
}

export function fitOneLine({
  available,
  textWidth,
  size,
  floor,
}: OneLineFitInput): OneLineFit {
  if (textWidth <= available) return { fontSize: size, truncates: false };
  const fitted = (size * available) / textWidth;
  return fitted < floor
    ? { fontSize: floor, truncates: true }
    : { fontSize: fitted, truncates: false };
}

export function oneLineFloor(
  fontScale: number,
  size: number,
  minSize: number,
): number {
  return isTextScaled(fontScale) ? size / grownTextScale(fontScale) : minSize;
}

// Yoga sizes an absolute child of a row to its max-content width, so the
// measurer reports the unwrapped line however narrow the row is.
export const oneLineMeasure = {
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    opacity: 0,
  },
  text: { position: 'absolute' },
  hidden: { opacity: 0 },
} as const;
