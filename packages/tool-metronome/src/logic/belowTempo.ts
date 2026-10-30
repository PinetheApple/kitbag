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

// Explicit line heights scale with the system font; the marker's minHeight
// keeps it from shrinking below the token.
export function labelLineHeight(fontScale: number): number {
  return metronome.beatMarkerLineHeight * Math.max(1, fontScale);
}

function beatLabelHeight(fontScale: number): number {
  return (
    metronome.beatMarkerGap +
    metronome.pulseMark +
    metronome.beatMarkerGap +
    labelLineHeight(fontScale)
  );
}

export const BEAT_LABEL_HEIGHT = beatLabelHeight(1);

const LIVE_STATUS_ROWS = 2;

export const STATUS_ROW_PITCH = metronome.statusRow + metronome.statusRowGap;

export const STATUS_STACK_HEIGHT =
  STATUS_ROW_PITCH * (LIVE_STATUS_ROWS - 1) + metronome.statusRow;

export interface BeatDotsShape {
  readonly beatCount: number;
  readonly poly: boolean;
}

export interface BelowTempoRoom {
  readonly width: number;
  readonly gap: number;
  readonly fontScale: number;
}

// The poly ratio is reserved above its dots, where PolyDots moves it when it
// is too tall or too wide to sit beside them.
function polyBlockHeight(fontScale: number): number {
  return (
    metronome.beatDotLineGap +
    labelLineHeight(fontScale) +
    metronome.beatMarkerGap +
    metronome.polyDot
  );
}

export function beatDotsHeight(
  shape: BeatDotsShape,
  room: BelowTempoRoom,
): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(lines, room.width, DOT_METRICS);
  const beatLines =
    lines.length * (dot + beatLabelHeight(room.fontScale)) +
    (lines.length - 1) * metronome.beatDotLineGap;
  return shape.poly ? beatLines + polyBlockHeight(room.fontScale) : beatLines;
}

export function belowTempoHeight(
  shape: BeatDotsShape,
  room: BelowTempoRoom,
): number {
  return beatDotsHeight(shape, room) + room.gap + STATUS_STACK_HEIGHT;
}

export function belowTempoReserve(room: BelowTempoRoom): number {
  let tallest = 0;
  for (let beatCount = 1; beatCount <= KB_MAX_BEATS; beatCount += 1) {
    tallest = Math.max(
      tallest,
      belowTempoHeight({ beatCount, poly: true }, room),
    );
  }
  return tallest;
}
