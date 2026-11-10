import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  openedSong,
  SONG_ID,
  songStore,
} from './store.test-helper.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function playingWithClickAndLoop() {
  const opened = await openedSong();
  const { store, engine } = opened;
  await store.getState().toggleClick();
  store.getState().togglePlay();
  engine.playing = true;
  engine.position = RATE;
  await store.getState().markLoop();
  engine.position = RATE * 2;
  await store.getState().markLoop();
  const before = store.getState();
  vi.clearAllMocks();
  return { ...opened, before };
}

describe('opening the song that is already open', () => {
  it('keeps playing it without loading it again', async () => {
    const { store, commands, records } = await playingWithClickAndLoop();
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(records.readSong).not.toHaveBeenCalled();
    expect(commands.loadTrack).not.toHaveBeenCalled();
    expect(commands.mixerStop).not.toHaveBeenCalled();
    expect(commands.mixerPause).not.toHaveBeenCalled();
    expect(commands.mixerSeek).not.toHaveBeenCalled();
    expect(commands.mixerClearLoop).not.toHaveBeenCalled();
  });

  it('keeps the click, the loop and the song facts', async () => {
    const { store, commands, before } = await playingWithClickAndLoop();
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState()).toEqual(before);
    expect(before.click).toBe(true);
    expect(before.loop.kind).toBe('on');
    expect(commands.metronomeStop).not.toHaveBeenCalled();
    expect(commands.clearGrid).not.toHaveBeenCalled();
  });

  it('closes the shared session when its last holder lets go', async () => {
    const store = songStore(fakeSongRuntime());
    const first = store.getState().open(SONG_ID, BARS);
    await first.loaded;
    const again = store.getState().open(SONG_ID, BARS).hold;
    again.release();
    again.release();
    expect(first.hold.live()).toBe(true);
    expect(store.getState().status).toBe('ready');
    first.hold.release();
    expect(again.live()).toBe(false);
    expect(store.getState().songId).toBeNull();
  });

  it('ignores a hold left over from an earlier session of the song', async () => {
    const store = songStore(fakeSongRuntime());
    const stale = store.getState().open(SONG_ID, BARS);
    await stale.loaded;
    store.getState().close();
    const current = store.getState().open(SONG_ID, BARS);
    await current.loaded;
    stale.hold.release();
    expect(current.hold.live()).toBe(true);
    expect(store.getState().status).toBe('ready');
    current.hold.release();
    expect(store.getState().songId).toBeNull();
  });

  it('loads it once when it is opened again while still loading', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const first = store.getState().open(SONG_ID, BARS);
    const again = store.getState().open(SONG_ID, BARS);
    await Promise.all([first.loaded, again.loaded]);
    expect(fake.commands.loadTrack).toHaveBeenCalledOnce();
    expect(store.getState().status).toBe('ready');
  });

  it('loads it again after it failed', async () => {
    const fake = fakeSongRuntime();
    fake.commands.loadTrack.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().status).toBe('failed');
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(fake.commands.loadTrack).toHaveBeenCalledTimes(2);
    expect(store.getState().status).toBe('ready');
  });
});

describe('opening another song', () => {
  it('replaces the playing one and turns its click off', async () => {
    const { store, commands } = await playingWithClickAndLoop();
    await store.getState().open(SONG_ID + 1, BARS).loaded;
    expect(commands.metronomeStop).toHaveBeenCalledOnce();
    expect(commands.mixerUnloadTrack).toHaveBeenCalledWith(0);
    expect(commands.loadTrack).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      songId: SONG_ID + 1,
      click: false,
      loop: { kind: 'off' },
      status: 'ready',
    });
  });
});
