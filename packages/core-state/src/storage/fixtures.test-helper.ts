import type { LibrarySongRow, LibraryStemSetRow } from '@kitbag/core-db';

const created = new Date(0);

export function songRow(fields: Partial<LibrarySongRow> = {}): LibrarySongRow {
  return {
    kind: 'song',
    id: 1,
    title: 'Everlong',
    artist: 'Foo Fighters',
    durationSec: 250,
    bpm: null,
    hasGrid: false,
    analysisStatus: 'done',
    analysisError: null,
    inSetlist: false,
    createdAt: created,
    ...fields,
  };
}

export function stemsRow(
  fields: Partial<LibraryStemSetRow> = {},
): LibraryStemSetRow {
  return {
    kind: 'stems',
    id: 1,
    title: 'Redbone',
    stemCount: 2,
    durationSec: 326,
    bpm: null,
    key: null,
    scale: null,
    hasGrid: false,
    createdAt: created,
    ...fields,
  };
}
