import {
  renderedFrameToMonotonicMs,
  type EngineClockPair,
} from '@kitbag/core-native';

import { SECONDS_PER_MINUTE } from '../text.ts';
import { CALIBRATION } from './calibrationRules.ts';

export interface ClickSchedule {
  readonly startFrame: number;
  readonly bpm: number;
}

export type CalibrationOutcome =
  | { readonly kind: 'refused'; readonly usable: number }
  | {
      readonly kind: 'measured';
      readonly meanMs: number;
      readonly sdMs: number;
      readonly usable: number;
      readonly steady: boolean;
    };

export function tapDeviationMs(
  tapMs: number,
  pair: EngineClockPair,
  schedule: ClickSchedule,
): number {
  const framesPerBeat = (pair.sampleRate * SECONDS_PER_MINUTE) / schedule.bpm;
  const startMs = renderedFrameToMonotonicMs(schedule.startFrame, pair);
  const msPerBeat =
    renderedFrameToMonotonicMs(schedule.startFrame + framesPerBeat, pair) -
    startMs;
  const beatsSinceStart = (tapMs - startMs) / msPerBeat;
  const beat = Math.max(0, Math.round(beatsSinceStart));
  const clickFrame = schedule.startFrame + beat * framesPerBeat;
  return tapMs - renderedFrameToMonotonicMs(clickFrame, pair);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleSd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const centre = mean(values);
  const squares = values.reduce((sum, v) => sum + (v - centre) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return mean(sorted.slice(middle - 1, middle + 1));
}

export function usableDeviations(deviations: readonly number[]): number[] {
  const typical = median(deviations);
  const near = deviations.filter(
    (d) => Math.abs(d - typical) <= CALIBRATION.usableWindowMs,
  );
  const centre = mean(near);
  const sd = sampleSd(near);
  if (sd === 0) return near;
  return near.filter((d) => Math.abs(d - centre) / sd <= CALIBRATION.maxAbsZ);
}

export function analyseTaps(deviations: readonly number[]): CalibrationOutcome {
  const usable = usableDeviations(deviations);
  if (usable.length < CALIBRATION.minUsableTaps) {
    return { kind: 'refused', usable: usable.length };
  }
  const sdMs = sampleSd(usable);
  return {
    kind: 'measured',
    meanMs: mean(usable),
    sdMs,
    usable: usable.length,
    steady: sdMs <= CALIBRATION.steadySdMs,
  };
}

export function storedOffsetMs(meanMs: number): number {
  return Math.round(meanMs);
}
