export interface BeatTick {
  readonly x: number;
  readonly tall: boolean;
}

const STRIDE_GROWTH = 2;

function smallestGap(xs: readonly number[]): number {
  let gap = Infinity;
  for (let i = 1; i < xs.length; i += 1) {
    gap = Math.min(gap, (xs[i] ?? 0) - (xs[i - 1] ?? 0));
  }
  return gap;
}

function strideToFit(xs: readonly number[], minGap: number): number {
  const gap = smallestGap(xs);
  let stride = 1;
  while (gap * stride < minGap && stride < xs.length) stride *= STRIDE_GROWTH;
  return stride;
}

export function beatTicks(
  beats: readonly number[],
  downbeatIndices: readonly number[],
  durationSec: number,
  width: number,
  minGap: number,
): readonly BeatTick[] {
  if (durationSec <= 0 || width <= 0) return [];
  const xAt = (index: number) => ((beats[index] ?? 0) / durationSec) * width;
  const inSong = (index: number) => {
    const beat = beats[index];
    return beat !== undefined && beat >= 0 && beat <= durationSec;
  };
  const beatIndices = beats.map((_, index) => index).filter(inSong);
  const barIndices = downbeatIndices.filter(inSong).sort((a, b) => a - b);
  const beatStride = strideToFit(beatIndices.map(xAt), minGap);
  if (beatStride === 1 || barIndices.length === 0) {
    const downbeats = new Set(barIndices);
    return beatIndices
      .filter((_, n) => n % beatStride === 0)
      .map((index) => ({ x: xAt(index), tall: downbeats.has(index) }));
  }
  const barStride = strideToFit(barIndices.map(xAt), minGap);
  return barIndices
    .filter((_, bar) => bar % barStride === 0)
    .map((index) => ({ x: xAt(index), tall: true }));
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
