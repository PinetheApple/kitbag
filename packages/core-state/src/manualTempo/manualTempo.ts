import {
  GRID_METER,
  GRID_METERS,
  isGridMeter,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  TEMPO_MAX_BPM,
  TEMPO_MIN_ANCHOR_SECONDS,
  TEMPO_MIN_BPM,
} from '@kitbag/core-db';

import { clamp, type BpmBounds } from '../metronome/config.ts';
import {
  pushTap,
  TAPS_TO_SET_TEMPO,
  tapIntervalBpm,
} from '../tapTempo/tapTempo.ts';
import { MINUS } from '../text.ts';

export const MANUAL_TEMPO_BOUNDS: BpmBounds = {
  min: TEMPO_MIN_BPM,
  max: TEMPO_MAX_BPM,
};

const TENTHS_PER_BPM = 10;
export const MANUAL_BPM_STEP = 1 / TENTHS_PER_BPM;

const ALL_TAPS = Number.POSITIVE_INFINITY;

export function manualBpm(bpm: number): number {
  const tenths = Math.round(bpm * TENTHS_PER_BPM) / TENTHS_PER_BPM;
  return clamp(tenths, MANUAL_TEMPO_BOUNDS.min, MANUAL_TEMPO_BOUNDS.max);
}

export function stepManualBpm(bpm: number, steps: number): number {
  return manualBpm((bpm * TENTHS_PER_BPM + steps) / TENTHS_PER_BPM);
}

export function pushManualTap(
  taps: readonly number[],
  nowMs: number,
): readonly number[] {
  return pushTap(taps, nowMs, MANUAL_TEMPO_BOUNDS, ALL_TAPS);
}

export function tappedManualBpm(taps: readonly number[]): number | null {
  if (taps.length < TAPS_TO_SET_TEMPO) return null;
  const bpm = tapIntervalBpm(taps);
  return bpm === undefined ? null : manualBpm(bpm);
}

export const MANUAL_TEMPO_LABEL = 'manual tempo';

export const MANUAL_TEMPO_RULES = {
  bounds: MANUAL_TEMPO_BOUNDS,
  bpmStep: MANUAL_BPM_STEP,
  tapsToSet: TAPS_TO_SET_TEMPO,
  minAnchorSeconds: TEMPO_MIN_ANCHOR_SECONDS,
  msPerSecond: MS_PER_SECOND,
  secondsPerMinute: SECONDS_PER_MINUTE,
  meters: GRID_METERS,
  defaultMeter: GRID_METER.quadruple,
  isMeter: isGridMeter,
  roundBpm: manualBpm,
  stepBpm: stepManualBpm,
  pushTap: pushManualTap,
  tappedBpm: tappedManualBpm,
  minus: MINUS,
};
