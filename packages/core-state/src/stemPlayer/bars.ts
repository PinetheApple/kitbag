import type { BarMark } from '@kitbag/core-db';

export function barMarkDownbeats(
  bars: readonly BarMark[],
  beatCount: number,
): readonly number[] {
  const downbeats: number[] = [];
  bars.forEach((mark, i) => {
    if (mark.beatsPerBar < 1) return;
    const end = Math.min(bars[i + 1]?.beat ?? beatCount, beatCount);
    for (let beat = mark.beat; beat < end; beat += mark.beatsPerBar)
      downbeats.push(beat);
  });
  return downbeats;
}

// set_grid refuses the whole grid for one bad index, which would lose the click.
export function usableDownbeats(
  indices: readonly number[],
  beatCount: number,
): readonly number[] {
  const kept: number[] = [];
  for (const index of indices) {
    const previous = kept.at(-1) ?? -1;
    if (Number.isInteger(index) && index > previous && index < beatCount)
      kept.push(index);
  }
  return kept;
}
