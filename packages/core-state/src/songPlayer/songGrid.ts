import {
  effectiveCorrection,
  meterOverrideOf,
  NO_METER_OVERRIDE,
  type ManualTempo,
  type MeterOverride,
  type SongRecord,
  type TempoCorrection,
  type TempoMode,
} from '@kitbag/core-db';

import { sameNumbers, usableDownbeats } from '../stemPlayer/bars.ts';
import { anchoredMeter } from '../manualTempo/manualGrid.ts';
import {
  isMeterOverridden,
  overrideDownbeats,
  type DetectedGrid,
  type DetectedMeter,
} from '../stemPlayer/meterOverride.ts';
import { correctedGrid } from '../stemPlayer/tempoCorrection.ts';
import {
  constantGrid,
  tempoGrid,
  tempoModeOf,
} from '../stemPlayer/tempoGrid.ts';

export interface SongGrid extends DetectedGrid {
  readonly detected: DetectedMeter;
}

export const NO_GRID: DetectedGrid = { beats: [], downbeatIndices: [] };

export type AnalysedSong = Pick<
  SongRecord,
  'beats' | 'downbeatIndices' | 'bpm' | 'tempo' | 'durationSec' | 'manualTempo'
>;

export const NO_ANALYSIS: AnalysedSong = {
  ...NO_GRID,
  bpm: null,
  tempo: null,
  durationSec: 0,
  manualTempo: null,
};

export function analysedGrid(
  song: AnalysedSong,
  mode: TempoMode | null,
): DetectedGrid {
  if (song.manualTempo !== null)
    return constantGrid(song.manualTempo, song.durationSec);
  return tempoGrid(song, song.tempo, mode, song.durationSec);
}

export function analysedSongGrid(
  song: AnalysedSong,
  mode: TempoMode | null,
  override: MeterOverride,
  correction: TempoCorrection,
): SongGrid {
  return songGrid(
    analysedGrid(song, mode),
    override,
    effectiveCorrection(song.manualTempo, correction),
    song.manualTempo,
  );
}

export function songGrid(
  analysed: DetectedGrid,
  shownOverride: MeterOverride,
  correction: TempoCorrection,
  manualTempo: ManualTempo | null,
): SongGrid {
  const { detected: found, override } = anchoredMeter(
    analysed,
    manualTempo,
    shownOverride,
  );
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
  return analysedSongGrid(
    record,
    mode,
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
  const unforced = analysedSongGrid(
    record,
    mode,
    NO_METER_OVERRIDE,
    record.tempoCorrection,
  );
  return !sameNumbers(downbeatTimes(shown), downbeatTimes(unforced));
}
