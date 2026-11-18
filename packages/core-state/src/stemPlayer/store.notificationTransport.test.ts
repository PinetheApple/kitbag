import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SongTransportShowState } from '@kitbag/core-native';

import {
  at,
  COUNT_END,
  countingSong,
  type opened,
} from './store.test-helper.ts';

const PLAY = { action: 'play', frame: null } as const;
const PAUSE = { action: 'pause', frame: null } as const;
const STOP = { action: 'stop', frame: null } as const;

async function counting() {
  const song = await countingSong();
  song.store.getState().togglePlay();
  await vi.runAllTimersAsync();
  vi.clearAllMocks();
  return song;
}

async function started() {
  const song = await counting();
  song.engine.now = COUNT_END;
  song.engine.playing = true;
  return song;
}

function shows({ commands }: Awaited<ReturnType<typeof opened>>) {
  const calls = commands.songTransportShow.mock.calls as [
    SongTransportShowState,
  ][];
  return calls.map(([state]) => state);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a notification action during the count', () => {
  it('pause cancels the count and the song together', async () => {
    const song = await counting();
    song.requestFromNotification(PAUSE);
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('stop ends the count as a stop after the start does, keeping the song open', async () => {
    const song = await counting();
    song.requestFromNotification(STOP);
    await vi.runAllTimersAsync();
    const state = song.store.getState();
    expect(state.status).toBe('ready');
    expect(state.countEndFrame).toBeNull();
    expect(state.click).toBe(false);
    expect(song.commands.songStop).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('play goes through the player toggle, which cancels the count', async () => {
    const song = await counting();
    song.requestFromNotification(PLAY);
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('seek counts in again from the bar at the new head', async () => {
    const song = await counting();
    song.requestFromNotification({ action: 'seek', frame: at(2.4) });
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerSeek.mock.calls).toEqual([[at(2.4)], [at(2)]]);
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });
});

describe('a notification action after the song started', () => {
  it('pause pauses the mixer only', async () => {
    const song = await started();
    song.requestFromNotification(PAUSE);
    expect(song.commands.mixerPause).toHaveBeenCalledTimes(1);
    expect(song.commands.songPause).not.toHaveBeenCalled();
  });

  it('stop is left to the engine', async () => {
    const song = await started();
    song.requestFromNotification(STOP);
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.store.getState().status).toBe('ready');
  });

  it('play while playing changes nothing', async () => {
    const song = await started();
    song.requestFromNotification(PLAY);
    expect(song.commands.mixerPause).not.toHaveBeenCalled();
    expect(song.commands.songPause).not.toHaveBeenCalled();
  });
});

describe('a notification action while paused', () => {
  it('pause changes nothing', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    vi.clearAllMocks();
    song.requestFromNotification(PAUSE);
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });
});

describe('the song card during the count', () => {
  it('is marked counting by every show of a counted play, the last one included', async () => {
    const song = await countingSong();
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    expect(shows(song).length).toBeGreaterThan(0);
    expect(shows(song).every((state) => state.countingIn)).toBe(true);
    expect(shows(song).at(-1)?.playing).toBe(true);
  });

  it('is not shown again by a recount', async () => {
    const song = await counting();
    song.store.getState().seek(at(2.4));
    await vi.runAllTimersAsync();
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
  });

  it('shows paused and not counting when the player cancels the count', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    expect(shows(song)).toEqual([
      expect.objectContaining({ playing: false, countingIn: false }),
    ]);
  });

  it('is not shown again by closing the player', async () => {
    const song = await counting();
    song.store.getState().close();
    await vi.runAllTimersAsync();
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
  });
});

describe('the notification subscription', () => {
  it('ends with the session', async () => {
    const song = await counting();
    expect(song.songRequestListeners.size).toBe(1);
    song.store.getState().close();
    expect(song.songRequestListeners.size).toBe(0);
  });
});
