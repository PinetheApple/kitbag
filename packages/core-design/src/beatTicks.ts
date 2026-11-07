export interface BeatTick {
  readonly x: number;
  readonly tall: boolean;
}

// A lane too dense to tell beats apart shows bars, not a comb of beat ticks
// with downbeats poking out of it.
export function beatTicks(
  beats: readonly number[],
  downbeatIndices: readonly number[],
  durationSec: number,
  width: number,
  columnWidth: number,
): readonly BeatTick[] {
  if (durationSec <= 0 || width <= 0) return [];
  const downbeatSet = new Set(downbeatIndices);
  const columns = new Map<number, boolean>();
  let crowded = false;
  for (const [index, beat] of beats.entries()) {
    if (beat < 0 || beat > durationSec) continue;
    const column = Math.floor(((beat / durationSec) * width) / columnWidth);
    const shared = columns.get(column);
    crowded ||= shared !== undefined;
    columns.set(column, (shared ?? false) || downbeatSet.has(index));
  }
  const barsOnly = crowded && [...columns.values()].some(Boolean);
  return [...columns]
    .filter(([, tall]) => tall || !barsOnly)
    .map(([column, tall]) => ({
      x: Math.min(column * columnWidth, width),
      tall,
    }));
}

export function tickPath(
  ticks: readonly BeatTick[],
  height: number,
  tickHeight: number,
): string {
  return ticks
    .map(
      ({ x }) =>
        `M${String(x)} ${String(height)}V${String(height - tickHeight)}`,
    )
    .join('');
}
