import {
  KB_BPM_REFERENCE_DENOMINATOR,
  type MediaSessionSnapshot,
} from '@kitbag/core-native';

import { SECONDS_PER_MINUTE } from '../text.ts';

export type ReportedPosition = Pick<
  MediaSessionSnapshot,
  'positionMs' | 'positionUpdatedAtMs' | 'playing' | 'speed'
>;

export function extrapolatedPositionMs(
  report: ReportedPosition,
  atBoottimeMs: number,
): number | null {
  if (report.positionMs === null) return null;
  if (!report.playing) return report.positionMs;
  return (
    report.positionMs +
    (atBoottimeMs - report.positionUpdatedAtMs) * report.speed
  );
}

export function barSeconds(
  bpm: number,
  beatsPerBar: number,
  denominator: number,
): number {
  const beatSec =
    (SECONDS_PER_MINUTE / bpm) * (KB_BPM_REFERENCE_DENOMINATOR / denominator);
  return beatsPerBar * beatSec;
}

// A negative position is silent until it reaches 0, so shift by whole bars; the
// shift is fixed for a given downbeat and bar so a re-anchor never reads as a jump.
export function engineSongSeconds(
  songSec: number,
  downbeatSec: number,
  barSec: number,
): number {
  const barsBack = Math.floor(downbeatSec / barSec) + 1;
  return songSec - downbeatSec + barsBack * barSec;
}
