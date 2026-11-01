import type { BeatLedLayout } from '@kitbag/core-design';

export function slotLayout(count: number, perRow: number): BeatLedLayout {
  const rows: number[][][] = [];
  for (let start = 0; start < count; start += perRow) {
    const end = Math.min(count, start + perRow);
    rows.push([Array.from({ length: end - start }, (_unused, i) => start + i)]);
  }
  return rows;
}
