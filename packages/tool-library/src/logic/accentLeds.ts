import type { BeatLedLayout, LedState } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { beatGroupSizes } from '@kitbag/core-state';

export const SHEET_LEDS_PER_ROW = 6;

export function accentLedState(accent: KB_ACCENT): LedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

export function accentLedLabel(beat: number, state: LedState): string {
  return `Beat ${String(beat + 1)}, ${state}`;
}

export function accentLedLayout(beatCount: number): BeatLedLayout {
  const rows: (readonly number[])[][] = [];
  let row: (readonly number[])[] = [];
  let rowLeds = 0;
  let beat = 0;
  for (const size of beatGroupSizes(beatCount)) {
    if (rowLeds + size > SHEET_LEDS_PER_ROW) {
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
