import {
  meterOverrideOf,
  NO_METER_OVERRIDE,
  type MeterOverride,
  type SongRecord,
  type TempoCorrection,
} from '@kitbag/core-db';

import { sameNumbers, usableDownbeats } from '../stemPlayer/bars.ts';
import {
  detectedMeter,
  isMeterOverridden,
  overrideDownbeats,
  type DetectedGrid,
  type DetectedMeter,
} from '../stemPlayer/meterOverride.ts';
import { nearestBeat } from '../stemPlayer/loop.ts';
import { correctedGrid } from '../stemPlayer/tempoCorrection.ts';

export interface SongGrid extends DetectedGrid {
  readonly detected: DetectedMeter;
}

export const NO_GRID: DetectedGrid = { beats: [], downbeatIndices: [] };

function scaledBarOne(
  corrected: DetectedGrid,
  detected: DetectedMeter,
): DetectedMeter {
  const index = nearestBeat(corrected.beats, detected.barOneSeconds);
  const beat = index === null ? undefined : corrected.beats[index];
  return { ...detected, barOneSeconds: beat ?? detected.barOneSeconds };
}

export function songGrid(
  analysed: DetectedGrid,
  override: MeterOverride,
  correction: TempoCorrection,
): SongGrid {
  const found = detectedMeter(analysed);
  const corrected = correctedGrid(
    analysed,
    correction,
    override.barOneSeconds ?? found.barOneSeconds,
  );
  if (corrected === analysed)
    return {
      beats: analysed.beats,
      downbeatIndices: overrideDownbeats(analysed, override),
      detected: found,
    };
  const detected = scaledBarOne(corrected, found);
  const barOneSeconds = override.barOneSeconds ?? detected.barOneSeconds;
  return {
    beats: corrected.beats,
    downbeatIndices: overrideDownbeats(corrected, {
      ...override,
      barOneSeconds,
    }),
    detected,
  };
}

export function recordGrid(record: SongRecord): SongGrid {
  return songGrid(record, meterOverrideOf(record), record.tempoCorrection);
}

export function sameGrid(a: DetectedGrid, b: DetectedGrid): boolean {
  return (
    sameNumbers(a.beats, b.beats) &&
    sameNumbers(a.downbeatIndices, b.downbeatIndices)
  );
}

export function overrideDisagrees(record: SongRecord): boolean {
  if (!isMeterOverridden(meterOverrideOf(record))) return false;
  const shown = recordGrid(record);
  const unforced = songGrid(record, NO_METER_OVERRIDE, record.tempoCorrection);
  return !sameNumbers(
    shown.downbeatIndices,
    usableDownbeats(unforced.downbeatIndices, unforced.beats.length),
  );
}
