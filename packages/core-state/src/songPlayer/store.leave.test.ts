import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songStore,
} from './store.test-helper.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('leaving the player', () => {
  it('keeps a ready song playing with its click', async () => {
    const fake = fakeSongRuntime();
    const { commands } = fake;
    const store = songStore(fake);
    const { hold, loaded } = store.getState().open(SONG_ID, BARS);
    await loaded;
    await store.getState().toggleClick();
    store.getState().togglePlay();
    vi.clearAllMocks();
    hold.release();
    expect(store.getState()).toMatchObject({
      songId: SONG_ID,
      status: 'ready',
      click: true,
    });
    expect(commands.mixerStop).not.toHaveBeenCalled();
    expect(commands.mixerPause).not.toHaveBeenCalled();
    expect(commands.metronomeStop).not.toHaveBeenCalled();
    expect(commands.engineRelease).not.toHaveBeenCalled();
  });

  it('keeps it after the last of several screens leaves', async () => {
    const store = songStore(fakeSongRuntime());
    const first = store.getState().open(SONG_ID, BARS);
    await first.loaded;
    const again = store.getState().open(SONG_ID, BARS);
    again.hold.release();
    first.hold.release();
    expect(store.getState().status).toBe('ready');
  });

  it('reattaches without reloading when the player opens again', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const first = store.getState().open(SONG_ID, BARS);
    await first.loaded;
    first.hold.release();
    const again = store.getState().open(SONG_ID, BARS);
    await again.loaded;
    expect(again.hold.live()).toBe(true);
    expect(fake.commands.loadTrack).toHaveBeenCalledOnce();
  });

  it('closes a song that is still loading', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const session = store.getState().open(SONG_ID, BARS);
    session.hold.release();
    await session.loaded;
    expect(store.getState().songId).toBeNull();
    expect(fake.commands.engineRelease).toHaveBeenCalledTimes(
      fake.commands.engineHold.mock.calls.length,
    );
  });

  it('closes a song that failed to open', async () => {
    const fake = fakeSongRuntime();
    fake.commands.loadTrack.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    const store = songStore(fake);
    const session = store.getState().open(SONG_ID, BARS);
    await session.loaded;
    expect(store.getState().status).toBe('failed');
    session.hold.release();
    expect(store.getState().songId).toBeNull();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
  });
});

describe('closing a song that outlived its player', () => {
  it('stops it and lets the engine go', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const session = store.getState().open(SONG_ID, BARS);
    await session.loaded;
    await store.getState().toggleClick();
    session.hold.release();
    store.getState().close();
    expect(store.getState().status).toBe('idle');
    expect(fake.commands.mixerStop).toHaveBeenCalledOnce();
    expect(fake.commands.metronomeStop).toHaveBeenCalledOnce();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
  });
});
