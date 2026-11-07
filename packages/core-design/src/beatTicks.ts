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
  const timeOf = (index: number) => beats[index] ?? NaN;
  const xAt = (index: number) => (timeOf(index) / durationSec) * width;
  const byTime = (indices: Iterable<number>) =>
    [...indices]
      .filter((index) => timeOf(index) >= 0 && timeOf(index) <= durationSec)
      .sort((a, b) => timeOf(a) - timeOf(b))
      .filter(
        (index, n, sorted) =>
          n === 0 || timeOf(index) > timeOf(sorted[n - 1] ?? index),
      );
  const beatIndices = byTime(beats.keys());
  const barIndices = byTime(new Set(downbeatIndices));
  const beatStride = strideToFit(beatIndices.map(xAt), minGap);
  if (beatStride === 1) {
    const downbeatTimes = new Set(barIndices.map(timeOf));
    return beatIndices.map((index) => ({
      x: xAt(index),
      tall: downbeatTimes.has(timeOf(index)),
    }));
  }
  if (barIndices.length === 0) {
    return beatIndices
      .filter((_, n) => n % beatStride === 0)
      .map((index) => ({ x: xAt(index), tall: false }));
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
