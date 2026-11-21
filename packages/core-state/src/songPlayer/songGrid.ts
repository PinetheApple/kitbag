import {
  meterOverrideOf,
  NO_METER_OVERRIDE,
  type MeterOverride,
  type SongRecord,
  type TempoCorrection,
  type TempoMode,
} from '@kitbag/core-db';

import { sameNumbers, usableDownbeats } from '../stemPlayer/bars.ts';
import {
  detectedMeter,
  isMeterOverridden,
  overrideDownbeats,
  type DetectedGrid,
  type DetectedMeter,
} from '../stemPlayer/meterOverride.ts';
import { correctedGrid } from '../stemPlayer/tempoCorrection.ts';
import { tempoGrid, tempoModeOf } from '../stemPlayer/tempoGrid.ts';

export interface SongGrid extends DetectedGrid {
  readonly detected: DetectedMeter;
}

export const NO_GRID: DetectedGrid = { beats: [], downbeatIndices: [] };

export type AnalysedSong = Pick<
  SongRecord,
  'beats' | 'downbeatIndices' | 'bpm' | 'tempo' | 'durationSec'
>;

export const NO_ANALYSIS: AnalysedSong = {
  ...NO_GRID,
  bpm: null,
  tempo: null,
  durationSec: 0,
};

export function analysedGrid(
  song: AnalysedSong,
  mode: TempoMode | null,
): DetectedGrid {
  return tempoGrid(song, song.tempo, mode, song.durationSec);
}

export function songGrid(
  analysed: DetectedGrid,
  override: MeterOverride,
  correction: TempoCorrection,
): SongGrid {
  const found = detectedMeter(analysed);
  const barOneSeconds = override.barOneSeconds ?? found.barOneSeconds;
  const corrected = correctedGrid(analysed, correction, barOneSeconds);
  if (corrected === analysed)
    return {
      beats: analysed.beats,
      downbeatIndices: overrideDownbeats(analysed, override),
      detected: found,
    };
  return {
    beats: corrected.beats,
    downbeatIndices: overrideDownbeats(corrected, {
      ...override,
      barOneSeconds,
    }),
    detected: found,
  };
}

export function recordGrid(
  record: SongRecord,
  mode: TempoMode | null = tempoModeOf(record),
): SongGrid {
  return songGrid(
    analysedGrid(record, mode),
    meterOverrideOf(record),
    record.tempoCorrection,
  );
}

export function sameGrid(a: DetectedGrid, b: DetectedGrid): boolean {
  return (
    sameNumbers(a.beats, b.beats) &&
    sameNumbers(a.downbeatIndices, b.downbeatIndices)
  );
}

function downbeatTimes({ beats, downbeatIndices }: DetectedGrid): number[] {
  return usableDownbeats(downbeatIndices, beats.length).map(
    (index) => beats[index] ?? Number.NaN,
  );
}

export function overrideDisagrees(
  record: SongRecord,
  mode: TempoMode | null = tempoModeOf(record),
): boolean {
  if (!isMeterOverridden(meterOverrideOf(record))) return false;
  const shown = recordGrid(record, mode);
  const unforced = songGrid(
    analysedGrid(record, mode),
    NO_METER_OVERRIDE,
    record.tempoCorrection,
  );
  return !sameNumbers(downbeatTimes(shown), downbeatTimes(unforced));
}
