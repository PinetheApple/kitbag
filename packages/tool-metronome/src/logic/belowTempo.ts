import { metronome } from '@kitbag/core-design';
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

// Measured on the emulator: a beat label with a 14 dp lineHeight draws
// 17.7–18.2 dp on Android, so the reserve counts the drawn height.
const DRAWN_LABEL_LINE = 18.2;

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

export const STATUS_ROW_PITCH = metronome.statusRow + metronome.statusRowGap;

export const STATUS_STACK_HEIGHT =
  STATUS_ROW_PITCH * (LIVE_STATUS_ROWS - 1) + metronome.statusRow;

export type PolyRow = 'off' | 'labelBeside' | 'labelAbove';

export interface BeatDotsShape {
  readonly beatCount: number;
  readonly poly: PolyRow;
}

export interface BelowTempoRoom {
  readonly width: number;
  readonly density: ScreenDensity;
  readonly gap: number;
  readonly fontScale: number;
}

function drawnLabelLine(fontScale: number): number {
  return DRAWN_LABEL_LINE * Math.max(1, fontScale);
}

function polyBlockHeight(poly: PolyRow, room: BelowTempoRoom): number {
  if (poly === 'off') return 0;
  const row = beatDotLineGap(room.density) + metronome.polyDot;
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
  const beatLabel =
    BEAT_LABEL_HEIGHT -
    metronome.beatMarkerLineHeight +
    drawnLabelLine(room.fontScale);
  const beatLines =
    lines.length * (dot + beatLabel) +
    (lines.length - 1) * beatDotLineGap(room.density);
  return beatLines + polyBlockHeight(shape.poly, room);
}

export function belowTempoHeight(
  shape: BeatDotsShape,
  room: BelowTempoRoom,
): number {
  return beatDotsHeight(shape, room) + room.gap + STATUS_STACK_HEIGHT;
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
