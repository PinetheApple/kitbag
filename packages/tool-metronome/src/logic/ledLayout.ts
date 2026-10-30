// Beat-LED layout — D9 (SPEC §5.2): the LEDs are a ROW and they GROUP, because
// grouping is a linear idea the old circle could not express (7/8 as 2+2+3).
// "Minimum 4 LEDs per row; rows wrap rather than shrinking below that", so a
// 16-beat bar is four rows of four, not sixteen unreadable dots.

export const MIN_LEDS_PER_ROW = 4;

// SPEC pins two points: 7 beats sit on one row (design §02 draws 7/8 as
// 2+2+3), and 16 beats become four rows of four. 7 is the only simple per-row
// ceiling that yields both — 8 would make 16 two rows of eight.
export const MAX_LEDS_PER_ROW = 7;

export const MAX_DOTS_PER_LINE = 8;

const DEFAULT_GROUP = 4;

// The two cell sizes an asymmetric meter is felt in.
const SHORT_CELL = 2;
const LONG_CELL = 3;

// Meters a plain chunk-by-four gets wrong, each written as the cells it is
// counted in; 7 -> 2+2+3 is the one design/kitbag-metronome.html §02 draws. The
// meter each row applies to is its own sum, so the two cannot drift apart.
const IRREGULAR_GROUPINGS: readonly (readonly number[])[] = [
  [LONG_CELL, SHORT_CELL],
  [LONG_CELL, LONG_CELL],
  [SHORT_CELL, SHORT_CELL, LONG_CELL],
  [LONG_CELL, LONG_CELL, LONG_CELL],
  [LONG_CELL, LONG_CELL, SHORT_CELL, SHORT_CELL],
  [LONG_CELL, LONG_CELL, LONG_CELL, SHORT_CELL],
  [LONG_CELL, LONG_CELL, LONG_CELL, LONG_CELL],
];

const beatsIn = (cells: readonly number[]) =>
  cells.reduce((total, cell) => total + cell, 0);

const IRREGULAR_GROUPS = new Map<number, readonly number[]>(
  IRREGULAR_GROUPINGS.map((cells) => [beatsIn(cells), cells]),
);

/** Group sizes for a bar of `beatCount` beats. */
export function beatGroupSizes(beatCount: number): readonly number[] {
  if (beatCount <= 0) return [];
  const irregular = IRREGULAR_GROUPS.get(beatCount);
  if (irregular !== undefined) return irregular;

  const sizes: number[] = [];
  for (let left = beatCount; left > 0; left -= DEFAULT_GROUP) {
    sizes.push(Math.min(left, DEFAULT_GROUP));
  }
  return sizes;
}

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
