export function polyDotCentres(
  polyBeats: number,
  lineWidth: number,
  dotSize: number,
  dotGap: number,
): readonly number[] {
  const barSpan = lineWidth + dotGap;
  return Array.from(
    { length: polyBeats },
    (_u, k) => dotSize / 2 + (k / polyBeats) * barSpan,
  );
}

export function polyLabelReach(
  wanted: number,
  sideRoom: number,
  screenInset: number,
): number {
  return Math.min(wanted, Math.max(0, sideRoom) + screenInset);
}

export function polyRatioLabel(polyBeats: number, beatsPerBar: number): string {
  return `${String(polyBeats)}:${String(beatsPerBar)}`;
}
