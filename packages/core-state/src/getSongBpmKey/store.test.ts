import { describe, expect, it } from 'vitest';

import {
  createGetSongBpmKeyStore,
  hasGetSongBpmKey,
  NO_GET_SONG_BPM_KEY,
} from './store.ts';

function remembered(stored: string = NO_GET_SONG_BPM_KEY) {
  const saved: string[] = [];
  const store = createGetSongBpmKeyStore({
    load: () => stored,
    save: (key) => {
      saved.push(key);
    },
  });
  return { store, saved };
}

describe('GetSongBPM key store', () => {
  it('starts with the key the device kept', () => {
    expect(remembered('kept-key').store.getState().key).toBe('kept-key');
    expect(hasGetSongBpmKey(remembered().store.getState().key)).toBe(false);
  });

  it('keeps an entered key without the spaces a paste brings', () => {
    const { store, saved } = remembered();
    store.getState().setKey('  pasted-key \n');
    expect(store.getState().key).toBe('pasted-key');
    expect(saved).toEqual(['pasted-key']);
  });

  it('ignores a blank entry instead of removing the key', () => {
    const { store, saved } = remembered('kept-key');
    store.getState().setKey('   ');
    expect(store.getState().key).toBe('kept-key');
    expect(saved).toEqual([]);
  });

  it('forgets the key when it is removed', () => {
    const { store, saved } = remembered('kept-key');
    store.getState().removeKey();
    expect(hasGetSongBpmKey(store.getState().key)).toBe(false);
    expect(saved).toEqual([NO_GET_SONG_BPM_KEY]);
  });
});
