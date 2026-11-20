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

function num(value: number): string {
  return String(Number(value.toFixed(PATH_DECIMALS)));
}

function roundedBar(x: number, y: number, w: number, h: number, r: number) {
  const corner = `A${num(r)} ${num(r)} 0 0 1 `;
  return (
    `M${num(x + r)} ${num(y)}H${num(x + w - r)}` +
    `${corner}${num(x + w)} ${num(y + r)}V${num(y + h - r)}` +
    `${corner}${num(x + w - r)} ${num(y + h)}H${num(x + r)}` +
    `${corner}${num(x)} ${num(y + h - r)}V${num(y + r)}` +
    `${corner}${num(x + r)} ${num(y)}Z`
  );
}

export function waveBarsPath(
  heights: readonly number[],
  lane: WaveLane,
): string {
  const bars = heights.length;
  const barWidth = (lane.width - lane.gap * (bars - 1)) / bars;
  if (bars === 0 || barWidth <= 0) return '';
  return heights
    .map((fraction, i) => {
      const h = fraction * lane.height;
      const r = Math.min(lane.radius, barWidth / 2, h / 2);
      const x = i * (barWidth + lane.gap);
      return roundedBar(x, (lane.height - h) / 2, barWidth, h, r);
    })
    .join('');
}
