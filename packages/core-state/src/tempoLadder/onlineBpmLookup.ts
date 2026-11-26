import type { BpmLookupSource, SongIdentity } from '@kitbag/core-db';

export interface OnlineBpmLookup {
  readonly id: BpmLookupSource;
  readonly lookUp: (
    song: SongIdentity,
    signal: AbortSignal,
  ) => Promise<number | null>;
}
