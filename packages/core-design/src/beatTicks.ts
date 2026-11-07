export interface BeatTick {
  readonly x: number;
  readonly tall: boolean;
}

export function beatTicks(
  beats: readonly number[],
  downbeats: readonly number[],
  durationSec: number,
  width: number,
  columnWidth: number,
): readonly BeatTick[] {
  if (durationSec <= 0 || width <= 0) return [];
  const tallBeats = new Set(downbeats);
  const columns = new Map<number, boolean>();
  beats.forEach((beat, index) => {
    if (beat < 0 || beat > durationSec) return;
    const column = Math.floor(((beat / durationSec) * width) / columnWidth);
    const tall = tallBeats.has(index);
    columns.set(column, (columns.get(column) ?? false) || tall);
  });
  return [...columns].map(([column, tall]) => ({
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
