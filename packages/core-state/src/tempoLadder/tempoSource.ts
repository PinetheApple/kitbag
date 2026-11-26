import type { BpmLookupSource, SongIdentity } from '@kitbag/core-db';

export interface TempoSource {
  readonly id: BpmLookupSource;
  readonly lookUp: (
    song: SongIdentity,
    signal: AbortSignal,
  ) => Promise<number | null>;
}
