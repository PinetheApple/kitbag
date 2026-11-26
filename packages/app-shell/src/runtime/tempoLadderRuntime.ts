import { configureTempoLadder } from '@kitbag/core-state';

import { getDatabase } from './database.ts';

configureTempoLadder({
  cache: {
    get: (song) => getDatabase().bpmCache.get(song),
    put: (song, hit) => getDatabase().bpmCache.put(song, hit),
  },
  library: { list: () => getDatabase().songLibrary.list() },
  onlineLookups: () => [],
});
