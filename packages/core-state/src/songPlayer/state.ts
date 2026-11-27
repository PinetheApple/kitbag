import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import {
  ANALYSIS_STATUS,
  correctedBpm,
  NO_METER_OVERRIDE,
  TEMPO_CORRECTION,
  type AnalysisStatus,
  type BundleTempo,
  type ManualTempo,
  type MeterOverride,
  type SongRecord,
  type TempoCorrection,
  type TempoMode,
} from '@kitbag/core-db';

import type { TransportSlice } from '../stemPlayer/actions.ts';
import { FALLBACK_BEATS_PER_BAR } from '../stemPlayer/barMeter.ts';
import type { ClickSlice } from '../stemPlayer/clickActions.ts';
import type { LoopSlice } from '../stemPlayer/loopActions.ts';
import { gridBpm } from '../stemPlayer/tempoGrid.ts';
import type { DetectedMeter } from '../stemPlayer/meterOverride.ts';
import { CLOSED_CLICK_SETTINGS, type SongClickSettings } from './songClick.ts';
import { gridCorrection, type SongGrid } from './songGrid.ts';

export interface SongPlayerState extends TransportSlice, ClickSlice, LoopSlice {
  readonly songId: number | null;
  readonly bpm: number | null;
  readonly detectedBpm: number | null;
  readonly tempoCorrection: TempoCorrection;
  readonly tempo: BundleTempo | null;
  readonly tempoMode: TempoMode | null;
  readonly analysisStatus: AnalysisStatus;
  readonly envelope: readonly number[] | null;
  readonly meterOverride: MeterOverride;
  readonly detected: DetectedMeter;
  readonly meterNotice: DetectedMeter | null;
  readonly clickSettings: SongClickSettings;
  readonly countEndFrame: number | null;
  readonly speed: number;
  readonly manualTempo: ManualTempo | null;
  readonly analysedBpm: number | null;
  readonly analysedOffer: number | null;
  readonly tempoUndoable: boolean;
}

export const closedState: SongPlayerState = {
  status: 'idle',
  songId: null,
  title: '',
  artist: null,
  bpm: null,
  detectedBpm: null,
  tempoCorrection: TEMPO_CORRECTION.none,
  tempo: null,
  tempoMode: null,
  analysisStatus: ANALYSIS_STATUS.pending,
  durationFrames: 0,
  engineRate: 0,
  beats: [],
  downbeatIndices: [],
  envelope: null,
  meterOverride: NO_METER_OVERRIDE,
  detected: { meter: FALLBACK_BEATS_PER_BAR, barOneSeconds: 0 },
  meterNotice: null,
  loop: { kind: 'off' },
  loopFailure: null,
  click: false,
  clickSettings: CLOSED_CLICK_SETTINGS,
  countEndFrame: null,
  speed: KB_MIXER_UNITY_RATE,
  manualTempo: null,
  analysedBpm: null,
  analysedOffer: null,
  tempoUndoable: false,
};

type SongFacts = Pick<
  SongRecord,
  | 'title'
  | 'artist'
  | 'bpm'
  | 'tempo'
  | 'analysisStatus'
  | 'tempoCorrection'
  | 'manualTempo'
  | 'beats'
>;

export function namesOf(record: Pick<SongFacts, 'title' | 'artist'>) {
  return {
    title: record.title,
    artist: record.artist === '' ? null : record.artist,
  };
}

export function tempoFacts(
  record: Pick<SongFacts, 'bpm' | 'tempo' | 'manualTempo'>,
  mode: TempoMode | null,
  correction: TempoCorrection,
): Pick<SongPlayerState, 'bpm' | 'detectedBpm' | 'tempoMode'> {
  const detectedBpm = gridBpm(record, mode);
  return {
    bpm: correctedBpm(detectedBpm, gridCorrection(record, correction)),
    detectedBpm,
    tempoMode: mode,
  };
}

export function analysedBpmOf(
  record: Pick<SongFacts, 'bpm' | 'tempo' | 'beats'>,
  mode: TempoMode | null,
  correction: TempoCorrection,
): number | null {
  if (record.beats.length === 0) return null;
  return correctedBpm(
    gridBpm({ ...record, manualTempo: null }, mode),
    correction,
  );
}

export function factsOf(
  record: SongFacts,
  mode: TempoMode | null,
): Partial<SongPlayerState> {
  return {
    ...namesOf(record),
    ...tempoFacts(record, mode, record.tempoCorrection),
    tempo: record.tempo,
    tempoCorrection: record.tempoCorrection,
    analysisStatus: record.analysisStatus,
    manualTempo: record.manualTempo,
    analysedBpm: analysedBpmOf(record, mode, record.tempoCorrection),
  };
}

export function shownGrid({ beats, downbeatIndices }: SongGrid) {
  return { beats, downbeatIndices };
}
