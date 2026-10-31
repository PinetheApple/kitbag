import {
  KB_LATENCY_OFFSET_MS_BOUNDS,
  renderedFrameToMonotonicMs,
  type EngineClockPair,
} from '@kitbag/core-native';

import { CALIBRATION } from './calibrationRules.ts';

const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;
const HALF = 0.5;

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

export interface AppliedOffset {
  readonly offsetMs: number;
  readonly clamped: boolean;
}

export function tapDeviationMs(
  tapMs: number,
  pair: EngineClockPair,
  schedule: ClickSchedule,
): number {
  const framesPerBeat = (pair.sampleRate * SECONDS_PER_MINUTE) / schedule.bpm;
  const startMs = renderedFrameToMonotonicMs(schedule.startFrame, pair);
  const beatsSinceStart = ((tapMs - startMs) * schedule.bpm) / MS_PER_MINUTE;
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

export function usableDeviations(deviations: readonly number[]): number[] {
  const near = deviations.filter(
    (d) => Math.abs(d) <= CALIBRATION.maxClickDistanceMs,
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

export function appliedOffset(meanMs: number): AppliedOffset {
  const rounded = Math.round(meanMs);
  const offsetMs = Math.min(
    KB_LATENCY_OFFSET_MS_BOUNDS.max,
    Math.max(KB_LATENCY_OFFSET_MS_BOUNDS.min, rounded),
  );
  return { offsetMs, clamped: offsetMs !== rounded };
}

export function scatterHalfRangeMs(meanMs: number, sdMs: number): number {
  return Math.max(
    CALIBRATION.minScatterHalfRangeMs,
    Math.abs(meanMs) + CALIBRATION.scatterSdSpan * sdMs,
  );
}

export function scatterX(deviationMs: number, halfRangeMs: number): number {
  const x = HALF + deviationMs / (2 * halfRangeMs);
  return Math.min(1, Math.max(0, x));
}
