import { TEMPO_MAX_BPM, TEMPO_MIN_BPM } from '@kitbag/core-db';

import { clamp, type BpmBounds } from '../metronome/config.ts';
import {
  pushTap,
  TAPS_TO_SET_TEMPO,
  tapIntervalBpm,
} from '../tapTempo/tapTempo.ts';

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
