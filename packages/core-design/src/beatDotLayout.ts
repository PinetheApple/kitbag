import { metronome } from './metronomeRoles.ts';
import type { ScreenDensity } from './screenDensity.ts';

export type BeatLine = readonly (readonly number[])[];

export const MAX_DOTS_PER_LINE = 8;

export interface DotMetrics {
  readonly maxDot: number;
  readonly dotGap: number;
  readonly groupGap: number;
}

function lineGaps(line: BeatLine, metrics: DotMetrics): number {
  const inGroups = line.reduce(
    (total, group) => total + Math.max(0, group.length - 1) * metrics.dotGap,
    0,
  );
  return inGroups + Math.max(0, line.length - 1) * metrics.groupGap;
}

export function widestLineWidth(
  lines: readonly BeatLine[],
  dotSize: number,
  metrics: DotMetrics,
): number {
  return lines.reduce((widest, line) => {
    const dots = line.reduce((total, group) => total + group.length, 0);
    return Math.max(widest, dots * dotSize + lineGaps(line, metrics));
  }, 0);
}

/** One dot size for the whole bar: the largest that fits its fullest line. */
export function beatDotSize(
  lines: readonly BeatLine[],
  width: number,
  metrics: DotMetrics,
): number {
  let dot = metrics.maxDot;
  for (const line of lines) {
    const dots = line.reduce((total, group) => total + group.length, 0);
    if (dots === 0) continue;
    dot = Math.min(dot, Math.floor((width - lineGaps(line, metrics)) / dots));
  }
  return Math.max(0, dot);
}

export const DOT_METRICS: DotMetrics = {
  maxDot: metronome.beatDotMax,
  dotGap: metronome.beatDotGap,
  groupGap: metronome.beatDotGroupGap,
};

const COMPACT_MULTI_LINE_METRICS: DotMetrics = {
  ...DOT_METRICS,
  maxDot: metronome.beatDotMaxCompactMultiLine,
};

const LINE_GAP: Readonly<Record<ScreenDensity, number>> = {
  roomy: metronome.beatDotLineGap,
  compact: metronome.beatDotLineGapCompact,
};

export function beatDotLineGap(density: ScreenDensity): number {
  return LINE_GAP[density];
}

export function beatDotMetrics(
  density: ScreenDensity,
  lines: readonly BeatLine[],
): DotMetrics {
  return density === 'compact' && lines.length > 1
    ? COMPACT_MULTI_LINE_METRICS
    : DOT_METRICS;
}

export interface BeatDotGeometry {
  readonly metrics: DotMetrics;
  readonly dotSize: number;
  readonly lineGap: number;
}

export function beatDotGeometry(
  lines: readonly BeatLine[],
  width: number,
  density: ScreenDensity,
): BeatDotGeometry {
  const metrics = beatDotMetrics(density, lines);
  return {
    metrics,
    dotSize: beatDotSize(lines, width, metrics),
    lineGap: beatDotLineGap(density),
  };
}

export const BEAT_LABEL_HEIGHT =
  metronome.beatMarkerGap +
  metronome.pulseMark +
  metronome.beatMarkerGap +
  metronome.beatMarkerLineHeight;
