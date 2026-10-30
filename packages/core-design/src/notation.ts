export const notationGeometry = {
  height: 28,
  firstHeadX: 4,
  headY: 24.5,
  headWidth: 6.6,
  headHeight: 4.8,
  headTiltDeg: -22,
  stemOffsetX: 2.4,
  stemTop: 8,
  stemWidth: 1.2,
  stemHeight: 16.5,
  beamThickness: 2.2,
  beamPitch: 3.4,
  numeralBaseline: 5.6,
  wideSpacing: 7.5,
  narrowSpacing: 5.5,
  wideMaxNotes: 4,
  maxNotes: 8,
  rightPad: 6,
} as const;

export interface NotationBeam {
  readonly y: number;
}

export interface NotationLayout {
  readonly width: number;
  readonly headXs: readonly number[];
  readonly stemXs: readonly number[];
  readonly beamX: number;
  readonly beamWidth: number;
  readonly beams: readonly NotationBeam[];
  readonly numeral: { readonly text: string; readonly x: number } | null;
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(Math.log2(n));
}

export function notationLayout(subdivision: number): NotationLayout {
  const g = notationGeometry;
  const clicks = Math.max(1, Math.round(subdivision));
  const notes = Math.min(clicks, g.maxNotes);
  const spacing = notes <= g.wideMaxNotes ? g.wideSpacing : g.narrowSpacing;
  const headXs = Array.from(
    { length: notes },
    (_unused, i) => g.firstHeadX + i * spacing,
  );
  const stemXs = headXs.map((x) => x + g.stemOffsetX);
  const beamX = stemXs[0] ?? 0;
  const beamWidth = (stemXs.at(-1) ?? 0) + g.stemWidth - beamX;
  const beams = Array.from(
    { length: Math.floor(Math.log2(clicks)) },
    (_unused, i) => ({ y: g.stemTop + i * g.beamPitch }),
  );
  const numeral = isPowerOfTwo(clicks)
    ? null
    : { text: String(clicks), x: beamX + beamWidth / 2 };
  return {
    width: (headXs.at(-1) ?? 0) + g.rightPad,
    headXs,
    stemXs,
    beamX,
    beamWidth,
    beams,
    numeral,
  };
}
