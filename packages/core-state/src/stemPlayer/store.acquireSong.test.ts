import { describe, expect, it, vi } from 'vitest';

import { createStemPlayerStore } from './store.ts';
import {
  BARS,
  fakeRuntime,
  record,
  SAVE_MS,
  SEEK_MS,
  stem,
} from './store.test-helper.ts';

const SET_ID = 7;
const STEMS = [stem(1), stem(2)];
const OPENS = 2;

function setup() {
  const fake = fakeRuntime(record(STEMS));
  const store = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
  });
  const acquire = () => store.getState().acquireSong(SET_ID, BARS).release;
  const ready = () =>
    vi.waitFor(() => {
      expect(store.getState().status).toBe('ready');
    });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { ...fake, store, acquire, ready, flush };
}

describe('a screen holding a song in the stem player', () => {
  it('stays open when the old screen releases after the new screen acquired', async () => {
    const { commands, store, acquire, ready, flush } = setup();
    const releaseOld = acquire();
    await ready();
    acquire();
    releaseOld();
    await flush();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().setId).toBe(SET_ID);
    expect(commands.engineRelease).not.toHaveBeenCalled();
    expect(commands.loadTrack).toHaveBeenCalledTimes(STEMS.length * OPENS);
    expect(commands.mixerUnloadTrack).toHaveBeenCalledTimes(STEMS.length);
  });

  it('stays open when the old screen releases while the new one is opening', async () => {
    const { commands, acquire, ready } = setup();
    const releaseOld = acquire();
    acquire();
    releaseOld();
    await ready();
    expect(commands.engineRelease).not.toHaveBeenCalled();
  });

  it('reopens when the old screen releases before the new screen acquired', async () => {
    const { commands, acquire, ready } = setup();
    const releaseOld = acquire();
    await ready();
    releaseOld();
    acquire();
    await ready();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
    expect(commands.engineHold).toHaveBeenCalledTimes(OPENS);
  });

  it('closes and releases the engine once when the current screen releases', async () => {
    const { commands, store, acquire, ready } = setup();
    const releaseOld = acquire();
    await ready();
    const releaseNew = acquire();
    await ready();
    releaseOld();
    releaseNew();
    releaseNew();
    expect(store.getState().status).toBe('idle');
    expect(store.getState().setId).toBeNull();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('does not close again after something else already closed the player', async () => {
    const { commands, store, acquire, ready } = setup();
    const release = acquire();
    await ready();
    commands.mixerStop.mockClear();
    store.getState().close();
    release();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
    expect(commands.mixerStop).toHaveBeenCalledOnce();
  });

  it('closes a song the screen left before it finished opening', async () => {
    const { commands, store, acquire, flush } = setup();
    const release = acquire();
    release();
    await flush();
    expect(store.getState().status).toBe('idle');
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });
});
