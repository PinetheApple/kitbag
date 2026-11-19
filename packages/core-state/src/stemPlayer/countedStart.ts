import { KB_COUNT_IN_OFF, KB_MAX_BEATS } from '@kitbag/core-native';

import { isCountInBars } from '../metronome/config.ts';
import { barLength, usableDownbeats } from './bars.ts';
import { secondsToFrames } from './time.ts';

export const COUNT_IN_DRAIN_MARGIN_SECONDS = 0.1;

export interface CountedStartRequest {
  readonly headFrame: number;
  readonly nowFrame: number;
  readonly engineRate: number;
  readonly playbackRate: number;
  readonly bars: number;
  readonly beats: readonly number[];
  readonly downbeatIndices: readonly number[];
  readonly unmarkedBeatsPerBar: number;
}

export interface CountedStart {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly beatFrames: number;
  readonly beatsPerBar: number;
}

function barAtOrBefore(
  headFrame: number,
  frameOf: (beat: number) => number,
  downbeats: readonly number[],
): number {
  return Math.max(
    0,
    downbeats.findLastIndex((beat) => frameOf(beat) <= headFrame),
  );
}

interface CountedBar {
  readonly startBeat: number;
  readonly beatsPerBar: number;
}

interface BarSource {
  readonly beatCount: number;
  readonly downbeats: readonly number[];
  readonly unmarkedBeatsPerBar: number;
}

function countedBar(
  headFrame: number,
  frameOf: (beat: number) => number,
  { beatCount, downbeats, unmarkedBeatsPerBar }: BarSource,
): CountedBar | null {
  if (downbeats.length === 0) {
    const everyBeat = Array.from({ length: beatCount }, (_, beat) => beat);
    const startBeat = barAtOrBefore(headFrame, frameOf, everyBeat);
    return { startBeat, beatsPerBar: unmarkedBeatsPerBar };
  }
  const bar = barAtOrBefore(headFrame, frameOf, downbeats);
  const startBeat = downbeats[bar];
  const beatsPerBar = barLength(downbeats, bar);
  if (startBeat === undefined || beatsPerBar === null) return null;
  return { startBeat, beatsPerBar };
}

function countInterval(beats: readonly number[], beat: number): number | null {
  const later = beat > 0 ? beat : beat + 1;
  const after = beats[later];
  const before = beats[later - 1];
  if (after === undefined || before === undefined) return null;
  return after > before ? after - before : null;
}

export function countedStart({
  headFrame,
  nowFrame,
  engineRate,
  playbackRate,
  bars,
  beats,
  downbeatIndices,
  unmarkedBeatsPerBar,
}: CountedStartRequest): CountedStart | null {
  if (!isCountInBars(bars) || bars === KB_COUNT_IN_OFF) return null;
  if (!(engineRate > 0) || !(playbackRate > 0)) return null;
  const downbeats = usableDownbeats(downbeatIndices, beats.length);
  const frameOf = (beat: number) =>
    secondsToFrames(beats[beat] ?? 0, engineRate);
  const counted = countedBar(headFrame, frameOf, {
    beatCount: beats.length,
    downbeats,
    unmarkedBeatsPerBar,
  });
  if (counted === null || counted.beatsPerBar > KB_MAX_BEATS) return null;
  const { startBeat, beatsPerBar } = counted;
  const interval = countInterval(beats, startBeat);
  if (interval === null) return null;
  const beatFrames = (interval * engineRate) / playbackRate;
  return {
    startFrame: frameOf(startBeat),
    endFrame: Math.round(
      nowFrame +
        secondsToFrames(COUNT_IN_DRAIN_MARGIN_SECONDS, engineRate) +
        bars * beatsPerBar * beatFrames,
    ),
    beatFrames,
    beatsPerBar,
  };
}
