import {
  configureTempoLadder,
  defaultOnlineLookups,
  getGetSongBpmKeyStore,
  type HttpGet,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';

const httpGet: HttpGet = (url, init) => fetch(url, init);

configureTempoLadder({
  cache: {
    get: (song) => getDatabase().bpmCache.get(song),
    put: (song, hit) => getDatabase().bpmCache.put(song, hit),
  },
  library: {
    list: () => getDatabase().songLibrary.list(),
    readSong: (id) => getDatabase().songLibrary.readSong(id),
    readStemSet: (id) => getDatabase().songLibrary.readStemSet(id),
  },
  onlineLookups: () =>
    defaultOnlineLookups(httpGet, getGetSongBpmKeyStore().getState().key),
});
