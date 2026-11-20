import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { at } from '../stemPlayer/store.test-helper.ts';
import { ONE_BAR, songWithCountIn } from './countIn.test-helper.ts';
import { openedSong } from './store.test-helper.ts';

const TAPPED = at(7);
const MID_SONG = at(4);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a tap on the waveform while the song plays', () => {
  it('moves the head and does not pause', async () => {
    const song = await openedSong();
    song.store.getState().togglePlay();
    song.engine.playing = true;
    song.engine.position = MID_SONG;
    vi.clearAllMocks();
    song.store.getState().seek(TAPPED);
    await vi.runAllTimersAsync();
    expect(song.commands.mixerSeek).toHaveBeenCalledWith(TAPPED);
    expect(song.commands.mixerPause).not.toHaveBeenCalled();
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
  });

  it('keeps the click running after the count has played', async () => {
    const song = await songWithCountIn(ONE_BAR);
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    song.engine.now = Number.MAX_SAFE_INTEGER;
    song.engine.playing = true;
    song.engine.position = MID_SONG;
    vi.clearAllMocks();
    song.store.getState().seek(TAPPED);
    await vi.runAllTimersAsync();
    expect(song.commands.mixerSeek).toHaveBeenCalledWith(TAPPED);
    expect(song.commands.mixerPause).not.toHaveBeenCalled();
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.commands.metronomeStop).not.toHaveBeenCalled();
    expect(song.store.getState().click).toBe(true);
  });
});
