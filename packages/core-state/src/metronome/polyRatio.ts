export interface PolyRatio {
  readonly polyBeats: number;
  readonly against: number;
  readonly beatsPerBar: number;
}

export function polyRatioLabel(ratio: PolyRatio): string {
  return `${String(ratio.polyBeats)}:${String(ratio.against)}`;
}
