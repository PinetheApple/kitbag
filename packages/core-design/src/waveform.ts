const PATH_DECIMALS = 2;

export interface WaveLane {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly radius: number;
}

export function waveBarHeights(
  envelope: readonly number[] | null,
  bars: number,
  minFraction: number,
): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const value =
      envelope === null || envelope.length === 0
        ? 0
        : (envelope[Math.floor((i * envelope.length) / bars)] ?? 0);
    return Math.min(1, Math.max(minFraction, value));
  });
}

function pathCoord(value: number): string {
  return String(Number(value.toFixed(PATH_DECIMALS)));
}

function roundedBar(x: number, y: number, w: number, h: number, r: number) {
  const corner = `A${pathCoord(r)} ${pathCoord(r)} 0 0 1 `;
  return (
    `M${pathCoord(x + r)} ${pathCoord(y)}H${pathCoord(x + w - r)}` +
    `${corner}${pathCoord(x + w)} ${pathCoord(y + r)}V${pathCoord(y + h - r)}` +
    `${corner}${pathCoord(x + w - r)} ${pathCoord(y + h)}H${pathCoord(x + r)}` +
    `${corner}${pathCoord(x)} ${pathCoord(y + h - r)}V${pathCoord(y + r)}` +
    `${corner}${pathCoord(x + r)} ${pathCoord(y)}Z`
  );
}

export function waveBarsPath(
  heights: readonly number[],
  lane: WaveLane,
): string {
  const bars = heights.length;
  if (bars === 0) return '';
  const barWidth = (lane.width - lane.gap * (bars - 1)) / bars;
  if (barWidth <= 0) return '';
  return heights
    .map((fraction, i) => {
      const h = fraction * lane.height;
      const r = Math.min(lane.radius, barWidth / 2, h / 2);
      const x = i * (barWidth + lane.gap);
      return roundedBar(x, (lane.height - h) / 2, barWidth, h, r);
    })
    .join('');
}
