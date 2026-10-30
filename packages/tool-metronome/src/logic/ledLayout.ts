import { beatGroupSizes } from '@kitbag/core-state';

export const MIN_LEDS_PER_ROW = 4;

export const MAX_LEDS_PER_ROW = 7;

export const MAX_DOTS_PER_LINE = 8;

/** One row of groups, each group a list of beat indices. */
export type LedRowLayout = readonly (readonly number[])[];

/**
 * Rows of groups of beat indices. Groups never split across rows, and a row
 * wraps when the next group would pass the ceiling.
 *
 * MIN_LEDS_PER_ROW is not a branch here. It falls out of the other two numbers:
 * with cells of at most DEFAULT_GROUP and a ceiling of MAX_LEDS_PER_ROW, no
 * filled row can end below the minimum. The measured exception is the LAST row,
 * which takes whatever is left: across 1–16 beats only 9 (6+3) ends short, and
 * that is pinned by a test rather than asserted here.
 */
export function layoutBeatLeds(
  beatCount: number,
  maxPerRow: number = MAX_LEDS_PER_ROW,
): readonly LedRowLayout[] {
  const rows: (readonly number[])[][] = [];
  let row: (readonly number[])[] = [];
  let rowLeds = 0;
  let beat = 0;

  for (const size of beatGroupSizes(beatCount)) {
    if (rowLeds + size > maxPerRow) {
      rows.push(row);
      row = [];
      rowLeds = 0;
    }
    row.push(Array.from({ length: size }, (_unused, i) => beat + i));
    rowLeds += size;
    beat += size;
  }

  if (row.length > 0) rows.push(row);
  return rows;
}

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
