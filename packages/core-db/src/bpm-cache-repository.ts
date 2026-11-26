import { and, eq } from 'drizzle-orm';

import { isBpmLookupSource, type BpmLookupSource } from './bpm-lookup-source';
import type { DatabaseHandle } from './repository';
import { bpmCache } from './schema';
import { songMatchKey, type SongIdentity } from './song-match-key';
import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from './units';

const DAYS_KEPT = 7;
export const BPM_CACHE_TTL_MS =
  DAYS_KEPT *
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MS_PER_SECOND;

export interface CachedBpm {
  readonly bpm: number;
  readonly source: BpmLookupSource;
}

export interface BpmCacheRepository {
  get(song: SongIdentity): Promise<CachedBpm | null>;
  put(song: SongIdentity, hit: CachedBpm): Promise<void>;
}

export function createBpmCacheRepository(
  { db, transactor }: DatabaseHandle,
  now: () => Date = () => new Date(),
): BpmCacheRepository {
  return {
    get: (song) =>
      transactor.serial(async () => {
        const { title, artist } = songMatchKey(song);
        const [row] = await db
          .select()
          .from(bpmCache)
          .where(and(eq(bpmCache.title, title), eq(bpmCache.artist, artist)));
        if (row === undefined || !isBpmLookupSource(row.source)) return null;
        const age = now().getTime() - row.fetchedAt.getTime();
        return age > BPM_CACHE_TTL_MS
          ? null
          : { bpm: row.bpm, source: row.source };
      }),
    put: (song, { bpm, source }) =>
      transactor.serial(async () => {
        const fetchedAt = now();
        await db
          .insert(bpmCache)
          .values({ ...songMatchKey(song), bpm, source, fetchedAt })
          .onConflictDoUpdate({
            target: [bpmCache.title, bpmCache.artist],
            set: { bpm, source, fetchedAt },
          });
      }),
  };
}
