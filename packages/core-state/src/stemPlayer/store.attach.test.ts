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
const TRACKS = 2;

function setup() {
  const fake = fakeRuntime(record([stem(1), stem(2)]));
  const store = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
  });
  const attach = () => store.getState().attach(SET_ID, BARS);
  const ready = () =>
    vi.waitFor(() => {
      expect(store.getState().status).toBe('ready');
    });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { ...fake, store, attach, ready, flush };
}

describe('a screen attached to the stem player', () => {
  it('stays open when the old screen lets go after the new screen attached', async () => {
    const { commands, store, attach, ready, flush } = setup();
    const oldScreen = attach();
    await ready();
    attach();
    oldScreen();
    await flush();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().setId).toBe(SET_ID);
    expect(commands.engineRelease).not.toHaveBeenCalled();
    expect(commands.loadTrack).toHaveBeenCalledTimes(TRACKS * 2);
    expect(commands.mixerUnloadTrack).toHaveBeenCalledTimes(TRACKS);
  });

  it('stays open when the old screen lets go while the new one is opening', async () => {
    const { commands, attach, ready } = setup();
    const oldScreen = attach();
    attach();
    oldScreen();
    await ready();
    expect(commands.engineRelease).not.toHaveBeenCalled();
  });

  it('reopens when the old screen lets go before the new screen attached', async () => {
    const { commands, attach, ready } = setup();
    const oldScreen = attach();
    await ready();
    oldScreen();
    attach();
    await ready();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
    expect(commands.engineHold).toHaveBeenCalledTimes(2);
  });

  it('closes and releases the engine once when the current screen lets go', async () => {
    const { commands, store, attach, ready } = setup();
    const oldScreen = attach();
    await ready();
    const newScreen = attach();
    await ready();
    oldScreen();
    newScreen();
    newScreen();
    expect(store.getState().status).toBe('idle');
    expect(store.getState().setId).toBeNull();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('does not close again after something else already closed the player', async () => {
    const { commands, store, attach, ready } = setup();
    const screen = attach();
    await ready();
    store.getState().close();
    screen();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('closes a song the screen left before it finished opening', async () => {
    const { commands, store, attach, flush } = setup();
    const screen = attach();
    screen();
    await flush();
    expect(store.getState().status).toBe('idle');
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });
});
