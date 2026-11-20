import {
  ANALYSIS_STATUS,
  correctedBpm,
  NO_METER_OVERRIDE,
  TEMPO_CORRECTION,
  type AnalysisStatus,
  type MeterOverride,
  type SongRecord,
  type TempoCorrection,
} from '@kitbag/core-db';

import type { TransportSlice } from '../stemPlayer/actions.ts';
import { FALLBACK_BEATS_PER_BAR } from '../stemPlayer/barMeter.ts';
import type { ClickSlice } from '../stemPlayer/clickActions.ts';
import type { LoopSlice } from '../stemPlayer/loopActions.ts';
import type { DetectedMeter } from '../stemPlayer/meterOverride.ts';
import { CLOSED_CLICK_SETTINGS, type SongClickSettings } from './songClick.ts';
import type { SongGrid } from './songGrid.ts';

export interface SongPlayerState extends TransportSlice, ClickSlice, LoopSlice {
  readonly songId: number | null;
  readonly bpm: number | null;
  readonly detectedBpm: number | null;
  readonly tempoCorrection: TempoCorrection;
  readonly analysisStatus: AnalysisStatus;
  readonly envelope: readonly number[] | null;
  readonly meterOverride: MeterOverride;
  readonly detected: DetectedMeter;
  readonly meterNotice: DetectedMeter | null;
  readonly clickSettings: SongClickSettings;
}

export const closedState: SongPlayerState = {
  status: 'idle',
  songId: null,
  title: '',
  artist: null,
  bpm: null,
  detectedBpm: null,
  tempoCorrection: TEMPO_CORRECTION.none,
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
};

type SongFacts = Pick<
  SongRecord,
  'title' | 'artist' | 'bpm' | 'analysisStatus' | 'tempoCorrection'
>;

export function namesOf(record: Pick<SongFacts, 'title' | 'artist'>) {
  return {
    title: record.title,
    artist: record.artist === '' ? null : record.artist,
  };
}

export function factsOf(record: SongFacts): Partial<SongPlayerState> {
  return {
    ...namesOf(record),
    bpm: correctedBpm(record.bpm, record.tempoCorrection),
    detectedBpm: record.bpm,
    tempoCorrection: record.tempoCorrection,
    analysisStatus: record.analysisStatus,
  };
}

export function shownGrid({ beats, downbeatIndices }: SongGrid) {
  return { beats, downbeatIndices };
}
