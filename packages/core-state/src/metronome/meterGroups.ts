import { KB_ACCENT } from '@kitbag/core-native';

const DEFAULT_GROUP = 4;

// The two cell sizes an asymmetric meter is felt in.
const SHORT_CELL = 2;
const LONG_CELL = 3;

// Each row's meter is its own sum, so the cells and the meter cannot drift apart.
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

export function groupStartAccents(beatCount: number): KB_ACCENT[] {
  const accents: KB_ACCENT[] = Array.from(
    { length: beatCount },
    () => KB_ACCENT.KB_ACCENT_NORMAL,
  );
  let start = 0;
  for (const size of beatGroupSizes(beatCount)) {
    accents[start] = KB_ACCENT.KB_ACCENT_ACCENTED;
    start += size;
  }
  return accents;
}
