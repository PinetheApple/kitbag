import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  openedSong,
  SONG_ID,
  songRecord,
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
    expect(records.readSong).toHaveBeenCalledExactlyOnceWith(SONG_ID);
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

  it('closes the shared session when its last holder of a loading song lets go', async () => {
    const store = songStore(fakeSongRuntime());
    const first = store.getState().open(SONG_ID, BARS);
    const again = store.getState().open(SONG_ID, BARS);
    again.hold.release();
    again.hold.release();
    expect(first.hold.live()).toBe(true);
    first.hold.release();
    await first.loaded;
    expect(again.hold.live()).toBe(false);
    expect(store.getState().songId).toBeNull();
  });

  it('ignores a hold left over from an earlier session of the song', async () => {
    const store = songStore(fakeSongRuntime());
    const stale = store.getState().open(SONG_ID, BARS);
    await stale.loaded;
    store.getState().close();
    const current = store.getState().open(SONG_ID, BARS);
    stale.hold.release();
    expect(current.hold.live()).toBe(true);
    current.hold.release();
    await current.loaded;
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

describe('reopening the live song after the library changed it', () => {
  it('shows its new title, artist, BPM and analysis status', async () => {
    const { store, records } = await playingWithClickAndLoop();
    records.readSong.mockResolvedValueOnce(
      songRecord({
        title: 'Renamed',
        artist: '',
        bpm: 90,
        analysisStatus: 'pending',
      }),
    );
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState()).toMatchObject({
      status: 'ready',
      title: 'Renamed',
      artist: null,
      bpm: 90,
      analysisStatus: 'pending',
      click: true,
    });
  });

  it('ends the session and shows the song as gone after a delete', async () => {
    const { store, records, commands } = await playingWithClickAndLoop();
    records.readSong.mockResolvedValueOnce(undefined);
    const { hold, loaded } = store.getState().open(SONG_ID, BARS);
    await loaded;
    expect(store.getState().status).toBe('missing');
    expect(hold.live()).toBe(false);
    expect(commands.mixerStop).toHaveBeenCalledOnce();
    expect(commands.metronomeStop).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });
});
