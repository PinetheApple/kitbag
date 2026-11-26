import type {
  BpmCacheRepository,
  SongLibraryRepository,
} from '@kitbag/core-db';

import type { OnlineBpmLookup } from './onlineBpmLookup.ts';

export interface TempoLadderRuntime {
  readonly cache: BpmCacheRepository;
  readonly library: Pick<
    SongLibraryRepository,
    'list' | 'readSong' | 'readStemSet'
  >;
  readonly onlineLookups: () => readonly OnlineBpmLookup[];
}

let configured: TempoLadderRuntime | undefined;

export function configureTempoLadder(runtime: TempoLadderRuntime): void {
  if (configured !== undefined && configured !== runtime) {
    throw new Error('Tempo ladder is already configured');
  }
  configured = runtime;
}

export function getTempoLadder(): TempoLadderRuntime {
  if (configured === undefined) {
    throw new Error('Tempo ladder is not configured');
  }
  return configured;
}
