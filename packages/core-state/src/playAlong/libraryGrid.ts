import { meterOverrideOf, type SongLibraryRepository } from '@kitbag/core-db';

import { NO_GRID, recordGrid } from '../songPlayer/songGrid.ts';
import { usableDownbeats } from '../stemPlayer/bars.ts';
import { clickGrid } from '../stemPlayer/loop.ts';
import {
  overrideDownbeats,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';
import { effectiveGrid } from '../stemPlayer/tempoGrid.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';

export type LibraryGridReader = Pick<
  SongLibraryRepository,
  'readSong' | 'readStemSet'
>;

async function storedGrid(
  library: LibraryGridReader,
  { kind, id }: LibraryMatch,
): Promise<DetectedGrid> {
  if (kind === 'song') {
    const song = await library.readSong(id);
    return song === undefined ? NO_GRID : recordGrid(song);
  }
  const stems = await library.readStemSet(id);
  if (stems === undefined) return NO_GRID;
  const grid = effectiveGrid(stems);
  return {
    beats: grid.beats,
    downbeatIndices: overrideDownbeats(grid, meterOverrideOf(stems)),
  };
}

export async function readLibraryGrid(
  library: LibraryGridReader,
  match: LibraryMatch,
): Promise<DetectedGrid> {
  const { beats, downbeatIndices } = await storedGrid(library, match);
  const clicked = clickGrid(beats);
  return {
    beats: clicked,
    downbeatIndices: usableDownbeats(downbeatIndices, clicked.length),
  };
}

export function firstDownbeatSec({
  beats,
  downbeatIndices,
}: DetectedGrid): number {
  return beats[downbeatIndices[0] ?? 0] ?? 0;
}
