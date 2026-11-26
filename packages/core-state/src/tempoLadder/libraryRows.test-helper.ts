import {
  ANALYSIS_STATUS,
  TEMPO_CORRECTION,
  type LibrarySongRow,
  type LibraryStemSetRow,
} from '@kitbag/core-db';

const CREATED = new Date(0);

export function songRow(fields: Partial<LibrarySongRow> = {}): LibrarySongRow {
  return {
    kind: 'song',
    id: 1,
    title: 'Under Pressure',
    artist: 'Queen',
    durationSec: 248,
    bpm: 113,
    tempoCorrection: TEMPO_CORRECTION.none,
    hasGrid: true,
    analysisStatus: ANALYSIS_STATUS.done,
    analysisError: null,
    inSetlist: false,
    createdAt: CREATED,
    ...fields,
  };
}

export function stemSetRow(
  fields: Partial<LibraryStemSetRow> = {},
): LibraryStemSetRow {
  return {
    kind: 'stems',
    id: 7,
    title: 'Under Pressure',
    artist: 'Queen',
    stemCount: 4,
    durationSec: 248,
    bpm: 113,
    key: null,
    scale: null,
    hasGrid: true,
    createdAt: CREATED,
    ...fields,
  };
}
