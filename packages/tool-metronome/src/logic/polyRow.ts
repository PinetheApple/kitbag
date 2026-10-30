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

export type PolyLabelPlace = 'left' | 'right' | 'above';

export interface PolyLabelRoom {
  readonly labelWidth: number;
  readonly labelHeight: number;
  readonly rowHeight: number;
  readonly labelGap: number;
  readonly sideRoom: number;
  readonly screenInset: number;
  readonly afterLastDot: number;
}

export function polyLabelPlace(room: PolyLabelRoom): PolyLabelPlace {
  if (room.labelHeight > room.rowHeight) return 'above';
  const needed = room.labelWidth + room.labelGap;
  const margin = Math.max(0, room.sideRoom) + room.screenInset;
  if (needed <= margin) return 'left';
  return needed <= room.afterLastDot + margin ? 'right' : 'above';
}

export function polyRatioLabel(polyBeats: number, beatsPerBar: number): string {
  return `${String(polyBeats)}:${String(beatsPerBar)}`;
}
