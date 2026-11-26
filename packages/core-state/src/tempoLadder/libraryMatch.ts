import {
  correctedBpm,
  type LibraryRow,
  type SongIdentity,
} from '@kitbag/core-db';

import { rankMatches } from './matchScore.ts';

export interface LibraryMatch {
  readonly kind: LibraryRow['kind'];
  readonly id: number;
  readonly bpm: number;
}

function analysedBpm(row: LibraryRow): number | null {
  if (!row.hasGrid) return null;
  return row.kind === 'song'
    ? correctedBpm(row.bpm, row.tempoCorrection)
    : row.bpm;
}

function candidateOf(row: LibraryRow) {
  const bpm = analysedBpm(row);
  if (bpm === null || bpm <= 0) return [];
  const { kind, id, title } = row;
  return [{ kind, id, bpm, title, artist: row.artist ?? '' }];
}

export function matchLibrary(
  song: SongIdentity,
  rows: readonly LibraryRow[],
): LibraryMatch | null {
  const [best] = rankMatches(song, rows.flatMap(candidateOf));
  return best === undefined
    ? null
    : { kind: best.kind, id: best.id, bpm: best.bpm };
}
