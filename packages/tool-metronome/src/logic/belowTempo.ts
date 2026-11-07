import { grownTextScale, isTextScaled, metronome } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';

import {
  beatDotSize,
  layoutBeatLeds,
  MAX_DOTS_PER_LINE,
  type DotMetrics,
  type LedRowLayout,
} from './ledLayout.ts';
import type { ScreenDensity } from './screenDensity.ts';

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
  lines: readonly LedRowLayout[],
): DotMetrics {
  return density === 'compact' && lines.length > 1
    ? COMPACT_MULTI_LINE_METRICS
    : DOT_METRICS;
}

export const BEAT_LABEL_HEIGHT =
  metronome.beatMarkerGap +
  metronome.pulseMark +
  metronome.beatMarkerGap +
  metronome.beatMarkerLineHeight;

const LIVE_STATUS_ROWS = 2;
const STATUS_LINES = 1;
// Android pads each line to the font's bbox (~1.4 em), so two grown lines fill the
// grown row; the progress bar gets its own strip below them. Computed, not measured.
const SCALED_STATUS_LINES = 2;

export function statusProgressReserve(fontScale: number): number {
  return isTextScaled(fontScale) ? metronome.statusProgress : 0;
}

export function statusRowHeight(fontScale: number): number {
  return (
    metronome.statusRow * grownTextScale(fontScale) +
    statusProgressReserve(fontScale)
  );
}

export function statusTextLines(fontScale: number): number {
  return isTextScaled(fontScale) ? SCALED_STATUS_LINES : STATUS_LINES;
}

export function statusRowPitch(fontScale: number): number {
  return statusRowHeight(fontScale) + metronome.statusRowGap;
}

export function statusStackPinned(fontScale: number): boolean {
  return isTextScaled(fontScale);
}

export function statusStackHeight(running: boolean, fontScale: number): number {
  const row = statusRowHeight(fontScale);
  return running
    ? statusRowPitch(fontScale) * (LIVE_STATUS_ROWS - 1) + row
    : row;
}

export type PolyRow = 'off' | 'labelBeside' | 'labelAbove';

export interface BeatDotsShape {
  readonly beatCount: number;
  readonly poly: PolyRow;
}

export interface BelowTempoRoom {
  readonly width: number;
  readonly density: ScreenDensity;
  readonly fontScale: number;
}

function drawnLabelLine(fontScale: number): number {
  return metronome.beatMarkerLineHeight * grownTextScale(fontScale);
}

export function beatLinePitch(
  density: ScreenDensity,
  dotSize: number,
  fontScale: number,
): number {
  const beatLabel =
    BEAT_LABEL_HEIGHT -
    metronome.beatMarkerLineHeight +
    drawnLabelLine(fontScale);
  return dotSize + beatLabel + beatDotLineGap(density);
}

function polyBlockHeight(poly: PolyRow, room: BelowTempoRoom): number {
  if (poly === 'off') return 0;
  const row = beatDotLineGap(room.density) + metronome.polyRow;
  if (poly === 'labelBeside') return row;
  return row + drawnLabelLine(room.fontScale) + metronome.beatMarkerGap;
}

export function beatDotsHeight(
  shape: BeatDotsShape,
  room: BelowTempoRoom,
): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(
    lines,
    room.width,
    beatDotMetrics(room.density, lines),
  );
  const beatLines =
    lines.length * beatLinePitch(room.density, dot, room.fontScale) -
    beatDotLineGap(room.density);
  return beatLines + polyBlockHeight(shape.poly, room);
}

function legendHeight(fontScale: number): number {
  return metronome.legendTop + metronome.legendRow * grownTextScale(fontScale);
}

export function belowTempoHeight(
  shape: BeatDotsShape,
  room: BelowTempoRoom,
): number {
  const dots = beatDotsHeight(shape, room);
  const legend = legendHeight(room.fontScale);
  if (statusStackPinned(room.fontScale)) return dots + legend;
  const stopped = legend + statusStackHeight(false, room.fontScale);
  const running = statusStackHeight(true, room.fontScale);
  return dots + Math.max(stopped, running);
}

export function tallestBelowTempo(poly: PolyRow, room: BelowTempoRoom): number {
  let tallest = 0;
  for (let beatCount = 1; beatCount <= KB_MAX_BEATS; beatCount += 1) {
    tallest = Math.max(tallest, belowTempoHeight({ beatCount, poly }, room));
  }
  return tallest;
}

// Roomy reserves every song's height so an overflow picks compact once per
// screen; compact is already fixed by the window, so nothing is reserved.
export function belowTempoReserve(room: BelowTempoRoom): number {
  return room.density === 'roomy' ? tallestBelowTempo('labelAbove', room) : 0;
}
