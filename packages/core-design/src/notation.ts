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
  maxBeams: 4,
  tileDenominator: 4,
  rightPad: 6,
} as const;

export const flaggedEighthGeometry = {
  width: 14,
  headX: 5,
  stemTop: 6,
  flagPath: 'M8.6 6c.6 3 4.4 4.6 4.2 9.4-.3-2.8-2.4-4.4-4.2-4.9z',
} as const;

export interface FlaggedEighthShape {
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
  readonly head: {
    readonly cx: number;
    readonly cy: number;
    readonly rx: number;
    readonly ry: number;
    readonly rotate: string;
  };
  readonly stem: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly flagPath: string;
}

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

function clicksOf(subdivision: number): number {
  return Math.max(1, Math.round(subdivision));
}

function beamCount(clicks: number, denominator: number): number {
  return (
    Math.floor(Math.log2(clicks)) +
    Math.log2(denominator / notationGeometry.tileDenominator)
  );
}

export function drawsFlaggedEighth(
  subdivision: number,
  denominator: number,
): boolean {
  const clicks = clicksOf(subdivision);
  return clicks === 1 && beamCount(clicks, denominator) === 1;
}

// The tiles draw only a lone quarter, a lone flagged eighth or a beamed group.
export function drawsNotation(
  subdivision: number,
  denominator: number,
): boolean {
  const clicks = clicksOf(subdivision);
  const beams = beamCount(clicks, denominator);
  const loneQuarter = clicks === 1 && beams === 0;
  const loneEighth = drawsFlaggedEighth(subdivision, denominator);
  const beamedGroup =
    clicks > 1 &&
    Number.isInteger(beams) &&
    beams > 0 &&
    beams <= notationGeometry.maxBeams;
  return loneQuarter || loneEighth || beamedGroup;
}

export function notationLayout(
  subdivision: number,
  denominator: number = notationGeometry.tileDenominator,
): NotationLayout {
  const g = notationGeometry;
  const clicks = clicksOf(subdivision);
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
    { length: Math.max(0, beamCount(clicks, denominator)) },
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

export function flaggedEighthShape(height: number): FlaggedEighthShape {
  const g = notationGeometry;
  const f = flaggedEighthGeometry;
  return {
    viewBox: `0 0 ${String(f.width)} ${String(g.height)}`,
    width: (f.width * height) / g.height,
    height,
    head: {
      cx: f.headX,
      cy: g.headY,
      rx: g.headWidth / 2,
      ry: g.headHeight / 2,
      rotate: `rotate(${String(g.headTiltDeg)} ${String(f.headX)} ${String(g.headY)})`,
    },
    stem: {
      x: f.headX + g.stemOffsetX,
      y: f.stemTop,
      width: g.stemWidth,
      height: g.headY - f.stemTop,
    },
    flagPath: f.flagPath,
  };
}
