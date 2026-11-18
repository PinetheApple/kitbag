import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNT_IN_DRAIN_MARGIN_SECONDS } from './countedStart.ts';
import { at, opened, SONG_DETAILS, stem } from './store.test-helper.ts';

const ONE_BAR = 1;
const TWO_FOUR = [{ beat: 0, beatsPerBar: 2 }];
const BEAT = 0.5;
const BAR_BEATS = 2;
const COUNT_END =
  at(COUNT_IN_DRAIN_MARGIN_SECONDS) + ONE_BAR * BAR_BEATS * at(BEAT);

const PLAY = { action: 'play', frame: null } as const;
const PAUSE = { action: 'pause', frame: null } as const;
const STOP = { action: 'stop', frame: null } as const;

async function counting() {
  const song = await opened([stem(1)], { ...SONG_DETAILS, bars: TWO_FOUR });
  song.countInBars.mockReturnValue(ONE_BAR);
  await song.store.getState().toggleClick();
  song.engine.position = at(1.2);
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

  it('stop ends the song as closing the player does', async () => {
    const song = await counting();
    song.requestFromNotification(STOP);
    expect(song.commands.songStop).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
    expect(song.commands.songTransportHide).toHaveBeenCalledTimes(1);
    expect(song.store.getState().setId).toBeNull();
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
  it('shows playing when a count starts', async () => {
    const song = await counting();
    song.store.getState().seek(at(2.4));
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: true }),
    );
  });

  it('shows paused when the player cancels the count', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ playing: false }),
    );
  });

  it('is not shown again by closing the player', async () => {
    const song = await counting();
    song.store.getState().close();
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
