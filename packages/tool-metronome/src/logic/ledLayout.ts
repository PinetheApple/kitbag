import type { LedRowLayout } from '@kitbag/core-state';

export const MAX_DOTS_PER_LINE = 8;

export interface DotMetrics {
  readonly maxDot: number;
  readonly dotGap: number;
  readonly groupGap: number;
}

function lineGaps(line: LedRowLayout, metrics: DotMetrics): number {
  const inGroups = line.reduce(
    (total, group) => total + Math.max(0, group.length - 1) * metrics.dotGap,
    0,
  );
  return inGroups + Math.max(0, line.length - 1) * metrics.groupGap;
}

export function widestLineWidth(
  lines: readonly LedRowLayout[],
  dotSize: number,
  metrics: DotMetrics,
): number {
  return lines.reduce((widest, line) => {
    const dots = line.reduce((total, group) => total + group.length, 0);
    return Math.max(widest, dots * dotSize + lineGaps(line, metrics));
  }, 0);
}

/** One dot size for the whole bar: the largest that fits its fullest line. */
export function beatDotSize(
  lines: readonly LedRowLayout[],
  width: number,
  metrics: DotMetrics,
): number {
  let dot = metrics.maxDot;
  for (const line of lines) {
    const dots = line.reduce((total, group) => total + group.length, 0);
    if (dots === 0) continue;
    dot = Math.min(dot, Math.floor((width - lineGaps(line, metrics)) / dots));
  }
  return Math.max(0, dot);
}
