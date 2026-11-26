import type {
  BpmCacheRepository,
  CachedBpm,
  LibraryRow,
  SongIdentity,
} from '@kitbag/core-db';

import type { HttpGet } from './http.ts';
import { offline } from './http.test-helper.ts';
import { defaultOnlineLookups } from './onlineLookups.ts';
import type { TempoLadderRuntime } from './runtime.ts';
import type { OnlineBpmLookup } from './onlineBpmLookup.ts';

export function memoryCache(initial: CachedBpm | null = null) {
  const puts: [SongIdentity, CachedBpm][] = [];
  const cache: BpmCacheRepository = {
    get: () => Promise.resolve(initial),
    put: (song, hit) => {
      puts.push([song, hit]);
      return Promise.resolve();
    },
  };
  return { cache, puts };
}

export function ladderRuntime(
  fields: {
    readonly cache?: BpmCacheRepository;
    readonly rows?: readonly LibraryRow[];
    readonly httpGet?: HttpGet;
    readonly key?: string;
    readonly lookups?: readonly OnlineBpmLookup[];
  } = {},
): TempoLadderRuntime {
  return {
    cache: fields.cache ?? memoryCache().cache,
    library: {
      list: () => Promise.resolve([...(fields.rows ?? [])]),
      readSong: () => Promise.resolve(undefined),
      readStemSet: () => Promise.resolve(undefined),
    },
    onlineLookups: () =>
      fields.lookups ??
      defaultOnlineLookups(fields.httpGet ?? offline, fields.key),
  };
}
