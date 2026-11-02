const DEFAULT_FONT_SCALE = 1;

export const UNLIMITED_LINES = 0;

export const TEXT_ICON_SCALE_MAX = 1.5;

export function grownTextScale(fontScale: number): number {
  return Math.max(DEFAULT_FONT_SCALE, fontScale);
}

export function isTextScaled(fontScale: number): boolean {
  return fontScale > DEFAULT_FONT_SCALE;
}

export function lineLimit(fontScale: number, lines: number): number {
  return isTextScaled(fontScale) ? UNLIMITED_LINES : lines;
}

export function textIconScale(fontScale: number): number {
  return Math.min(grownTextScale(fontScale), TEXT_ICON_SCALE_MAX);
}
