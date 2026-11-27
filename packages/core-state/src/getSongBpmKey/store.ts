import { persistedStore } from '../persistedStore.ts';

export const NO_GET_SONG_BPM_KEY = '';

export function hasGetSongBpmKey(key: string): boolean {
  return key !== NO_GET_SONG_BPM_KEY;
}

export interface GetSongBpmKeyPersistence {
  readonly load: () => string;
  readonly save: (key: string) => void;
}

export interface GetSongBpmKeyStore {
  readonly key: string;
  readonly setKey: (entered: string) => void;
  readonly removeKey: () => void;
}

const getSongBpmKey = persistedStore<
  GetSongBpmKeyPersistence,
  GetSongBpmKeyStore
>(
  'GetSongBPM key',
  { load: () => NO_GET_SONG_BPM_KEY, save: () => undefined },
  (persistence, commit) => ({
    key: persistence.load(),
    setKey: (entered) => {
      const key = entered.trim();
      if (hasGetSongBpmKey(key)) commit('key', key, persistence.save);
    },
    removeKey: () => {
      commit('key', NO_GET_SONG_BPM_KEY, persistence.save);
    },
  }),
);

export const createGetSongBpmKeyStore = getSongBpmKey.create;
export const configureGetSongBpmKeyPersistence = getSongBpmKey.configure;
export const getGetSongBpmKeyStore = getSongBpmKey.get;
