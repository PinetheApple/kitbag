import type {
  BpmCacheRepository,
  CachedBpm,
  LibraryRow,
  SongIdentity,
} from '@kitbag/core-db';

import type { HttpGet } from './http.ts';
import { offline } from './http.test-helper.ts';
import { defaultTempoSources } from './onlineSources.ts';
import type { TempoLadderRuntime } from './runtime.ts';
import type { TempoSource } from './tempoSource.ts';

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
    readonly sources?: readonly TempoSource[];
  } = {},
): TempoLadderRuntime {
  return {
    cache: fields.cache ?? memoryCache().cache,
    library: { list: () => Promise.resolve([...(fields.rows ?? [])]) },
    onlineSources: () =>
      fields.sources ??
      defaultTempoSources(fields.httpGet ?? offline, fields.key),
  };
}
