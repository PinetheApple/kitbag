import { metronome } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';

import {
  beatDotSize,
  layoutBeatLeds,
  MAX_DOTS_PER_LINE,
  type DotMetrics,
} from './ledLayout.ts';

export const DOT_METRICS: DotMetrics = {
  maxDot: metronome.beatDotMax,
  dotGap: metronome.beatDotGap,
  groupGap: metronome.beatDotGroupGap,
};

export const BEAT_LABEL_HEIGHT =
  metronome.beatMarkerGap +
  metronome.pulseMark +
  metronome.beatMarkerGap +
  metronome.beatMarkerLineHeight;

const LIVE_STATUS_ROWS = 2;

export const STATUS_ROW_PITCH = metronome.statusRow + metronome.statusRowGap;

export const STATUS_STACK_HEIGHT =
  STATUS_ROW_PITCH * (LIVE_STATUS_ROWS - 1) + metronome.statusRow;

export interface BeatDotsShape {
  readonly beatCount: number;
  readonly poly: boolean;
}

export function beatDotsHeight(shape: BeatDotsShape, width: number): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(lines, width, DOT_METRICS);
  const beatLines =
    lines.length * (dot + BEAT_LABEL_HEIGHT) +
    (lines.length - 1) * metronome.beatDotLineGap;
  if (!shape.poly) return beatLines;
  return beatLines + metronome.beatDotLineGap + metronome.polyDot;
}

export function belowTempoHeight(
  shape: BeatDotsShape,
  width: number,
  gap: number,
): number {
  return beatDotsHeight(shape, width) + gap + STATUS_STACK_HEIGHT;
}

export function belowTempoReserve(width: number, gap: number): number {
  let tallest = 0;
  for (let beatCount = 1; beatCount <= KB_MAX_BEATS; beatCount += 1) {
    const height = belowTempoHeight({ beatCount, poly: true }, width, gap);
    tallest = Math.max(tallest, height);
  }
  return tallest;
}
