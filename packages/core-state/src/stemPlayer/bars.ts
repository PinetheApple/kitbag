import type { BarMark } from '@kitbag/core-db';

// A mark opens a run of bars that lasts until the next mark or the grid's end.
export function downbeatIndices(
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
