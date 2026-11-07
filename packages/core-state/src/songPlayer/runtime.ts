import type { SongLibraryRepository } from '@kitbag/core-db';

import type { MixerRuntime } from '../stemPlayer/runtime.ts';

export type SongPlayerRecords = Pick<SongLibraryRepository, 'readSong'>;

export interface SongPlayerRuntime extends MixerRuntime {
  readonly records: SongPlayerRecords;
}

let configured: SongPlayerRuntime | undefined;

export function configureSongPlayer(runtime: SongPlayerRuntime): void {
  if (configured !== undefined && configured !== runtime) {
    throw new Error('Song player is already configured');
  }
  configured = runtime;
}

export function getSongPlayer(): SongPlayerRuntime {
  if (configured === undefined) {
    throw new Error('Song player is not configured');
  }
  return configured;
}
