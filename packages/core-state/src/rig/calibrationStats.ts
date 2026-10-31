import { MS_PER_SECOND } from '@kitbag/core-db';
import {
  KB_LATENCY_OFFSET_MS_BOUNDS,
  renderedFrameToMonotonicMs,
  type EngineClockPair,
} from '@kitbag/core-native';

import { SECONDS_PER_MINUTE } from '../text.ts';
import { CALIBRATION } from './calibrationRules.ts';

const BEAT_MS = (SECONDS_PER_MINUTE * MS_PER_SECOND) / CALIBRATION.bpm;
const FULL_TURN = 2 * Math.PI;

export type RefusalReason = 'too-few' | 'at-limit';

export interface ClickSchedule {
  readonly startFrame: number;
  readonly bpm: number;
}

export type CalibrationOutcome =
  | {
      readonly kind: 'refused';
      readonly reason: RefusalReason;
      readonly usable: number;
    }
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

function circularCentre(deviations: readonly number[]): number {
  const angles = deviations.map((d) => (FULL_TURN * d) / BEAT_MS);
  const sin = angles.reduce((sum, a) => sum + Math.sin(a), 0);
  const cos = angles.reduce((sum, a) => sum + Math.cos(a), 0);
  return (Math.atan2(sin, cos) * BEAT_MS) / FULL_TURN;
}

// A deviation is only known modulo one beat, so a route near half a beat
// late lands on both sides; unwrap around the circular mean before the median.
function unwrapped(deviations: readonly number[]): number[] {
  const centre = circularCentre(deviations);
  return deviations.map(
    (d) => d - BEAT_MS * Math.round((d - centre) / BEAT_MS),
  );
}

function atLimit(meanMs: number, sdMs: number): boolean {
  return (
    meanMs - sdMs < KB_LATENCY_OFFSET_MS_BOUNDS.min ||
    meanMs + sdMs > KB_LATENCY_OFFSET_MS_BOUNDS.max
  );
}

export function usableDeviations(deviations: readonly number[]): number[] {
  const unwrappedDeviations = unwrapped(deviations);
  const typical = median(unwrappedDeviations);
  const near = unwrappedDeviations.filter(
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
    return { kind: 'refused', reason: 'too-few', usable: usable.length };
  }
  const meanMs = mean(usable);
  const sdMs = sampleSd(usable);
  if (atLimit(meanMs, sdMs)) {
    return { kind: 'refused', reason: 'at-limit', usable: usable.length };
  }
  return {
    kind: 'measured',
    meanMs,
    sdMs,
    usable: usable.length,
    steady: sdMs <= CALIBRATION.steadySdMs,
  };
}

export function storedOffsetMs(meanMs: number): number {
  return Math.round(meanMs);
}
