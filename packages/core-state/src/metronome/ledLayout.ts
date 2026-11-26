import { KB_ACCENT } from '@kitbag/core-native';

import { beatGroupSizes } from './meterGroups.ts';

export const MIN_LEDS_PER_ROW = 4;

export const MAX_LEDS_PER_ROW = 7;

export type LedRowLayout = readonly (readonly number[])[];

export type AccentLedState = 'accented' | 'normal' | 'muted';

export function ledStateFor(accent: KB_ACCENT): AccentLedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

// MIN_LEDS_PER_ROW is no branch: the group sizes and the ceiling keep every
// filled row above it.
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
