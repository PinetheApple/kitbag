import { KB_COUNT_IN_OFF, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UNMARKED_BAR_BEATS } from './countedStart.ts';
import { RETIME_PLAYBACK_RATE } from './retimeSpeed.ts';
import {
  at,
  BAR_BEATS,
  BEAT,
  COUNT_END,
  countingSong,
  HEAD,
  opened,
  SONG_DETAILS,
  stem,
} from './store.test-helper.ts';

const TWO_BARS = 2;
const BAR_AT_HEAD = at(1);
const SONG_END = at(10);

type Song = Awaited<ReturnType<typeof countingSong>>;

async function counting(options: { click?: boolean } = {}) {
  const song = await countingSong(options);
  song.store.getState().togglePlay();
  await vi.runAllTimersAsync();
  return song;
}

function lastCall(mock: { mock: { invocationCallOrder: number[] } }): number {
  return mock.mock.invocationCallOrder.at(-1) ?? 0;
}

function counts({ commands }: Song) {
  return commands.songCountIn.mock.calls;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('play with a count-in', () => {
  it('counts the bar at the head in, then starts the song where the count ends', async () => {
    const song = await counting();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[BAR_AT_HEAD]]);
    expect(counts(song)).toEqual([[COUNT_END, at(BEAT), BAR_BEATS, true]]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('counts in with the click off, keeping the click off after', async () => {
    const song = await countingSong({ click: false });
    song.store.getState().togglePlay();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[BAR_AT_HEAD]]);
    expect(counts(song)).toEqual([[COUNT_END, at(BEAT), BAR_BEATS, false]]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBe(COUNT_END);
  });

  it('counts in a stem song whose bundle marks no bars', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    song.countInBars.mockReturnValue(TWO_BARS);
    song.engine.position = HEAD;
    vi.clearAllMocks();
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[BAR_AT_HEAD]]);
    const [call] = counts(song);
    expect(call?.[2]).toBe(UNMARKED_BAR_BEATS);
    expect(call?.[3]).toBe(false);
  });

  it('plays at once when the count-in is off', async () => {
    const song = await countingSong();
    song.countInBars.mockReturnValue(KB_COUNT_IN_OFF);
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('counts from the first bar when play starts the song over', async () => {
    const song = await countingSong();
    song.engine.position = SONG_END;
    song.store.getState().togglePlay();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[0], [0]]);
    expect(counts(song)).toEqual([[COUNT_END, at(BEAT), BAR_BEATS, true]]);
  });

  it('plays the song uncounted when the engine refuses the count', async () => {
    const song = await countingSong();
    song.commands.songCountIn.mockResolvedValueOnce(KB_RESULT.KB_ERROR_BUSY);
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    expect(song.commands.metronomeStart).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
  });
});

describe('during the count', () => {
  it('pause cancels the count and the song together, and keeps the click armed', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPause).not.toHaveBeenCalled();
    expect(song.commands.metronomeStart).toHaveBeenCalledTimes(1);
    expect(counts(song)).toHaveLength(1);
  });

  it('a second tap before the engine answers pauses', async () => {
    const song = await countingSong();
    song.store.getState().togglePlay();
    song.store.getState().togglePlay();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(counts(song)).toHaveLength(1);
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('a seek right after play counts in again', async () => {
    const song = await countingSong();
    song.store.getState().togglePlay();
    song.store.getState().seek(at(2.4));
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerSeek.mock.calls.at(-1)).toEqual([at(2)]);
    expect(counts(song)).toHaveLength(2);
  });

  it('turning the click off keeps the count and silences the click after', async () => {
    const song = await counting();
    await song.store.getState().toggleClick();
    expect(counts(song).at(-1)).toEqual([
      COUNT_END,
      at(BEAT),
      BAR_BEATS,
      false,
    ]);
    expect(song.commands.metronomeStop).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.metronomeFollowMixer).toHaveBeenLastCalledWith(false);
    expect(song.commands.clearGrid).toHaveBeenCalledTimes(1);
    expect(song.store.getState()).toMatchObject({
      click: false,
      countEndFrame: COUNT_END,
    });
  });

  it('turning the click on keeps the count and starts the click after', async () => {
    const song = await counting({ click: false });
    await song.store.getState().toggleClick();
    expect(counts(song).at(-1)).toEqual([COUNT_END, at(BEAT), BAR_BEATS, true]);
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
    expect(song.commands.metronomeFollowMixer).toHaveBeenLastCalledWith(true);
    expect(song.store.getState()).toMatchObject({
      click: true,
      countEndFrame: COUNT_END,
    });
  });

  it('toggling the click off and on re-issues the same count each time', async () => {
    const song = await counting();
    await song.store.getState().toggleClick();
    await song.store.getState().toggleClick();
    const endAndClick = counts(song).map((call) => [call[0], call[3]]);
    expect(endAndClick).toEqual([
      [COUNT_END, true],
      [COUNT_END, false],
      [COUNT_END, true],
    ]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('turning the click off re-issues the count before releasing the grid', async () => {
    const song = await counting();
    await song.store.getState().toggleClick();
    expect(lastCall(song.commands.songCountIn)).toBeLessThan(
      lastCall(song.commands.metronomeFollowMixer),
    );
  });

  it('a refused click-on re-issue starts the click, then the song', async () => {
    const song = await counting({ click: false });
    song.commands.songCountIn.mockResolvedValueOnce(KB_RESULT.KB_ERROR_BUSY);
    await song.store.getState().toggleClick();
    await vi.runAllTimersAsync();
    expect(song.commands.metronomeStart).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
    expect(lastCall(song.commands.metronomeStart)).toBeLessThan(
      lastCall(song.commands.mixerPlay),
    );
  });

  it('a refusal overtaken by a later re-issue is ignored', async () => {
    const song = await counting();
    let answer: (code: number) => void = () => undefined;
    song.commands.songCountIn.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    await song.store.getState().toggleClick();
    await song.store.getState().toggleClick();
    answer(KB_RESULT.KB_ERROR_BUSY);
    await vi.runAllTimersAsync();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBe(COUNT_END);
  });

  it('a click toggle after a notification Stop starts no count', async () => {
    const song = await counting();
    song.stopSongFromNotification();
    vi.clearAllMocks();
    await song.store.getState().toggleClick();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('a refused click-off re-issue stops the click and plays the song now', async () => {
    const song = await counting();
    song.commands.songCountIn.mockResolvedValueOnce(KB_RESULT.KB_ERROR_BUSY);
    await song.store.getState().toggleClick();
    await vi.runAllTimersAsync();
    expect(song.commands.metronomeStop).toHaveBeenCalledTimes(1);
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('a refusal arriving after a pause starts nothing', async () => {
    const song = await countingSong();
    let answer: (code: number) => void = () => undefined;
    song.commands.songCountIn.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    song.store.getState().togglePlay();
    song.store.getState().togglePlay();
    answer(KB_RESULT.KB_ERROR_BUSY);
    await vi.runAllTimersAsync();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('a seek counts in again from the bar at the new head', async () => {
    const song = await counting();
    song.store.getState().seek(at(2.4));
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerSeek.mock.calls.slice(1)).toEqual([
      [at(2.4)],
      [at(2)],
    ]);
    expect(counts(song)).toHaveLength(2);
  });

  it('a scrub counts in again once its seek lands', async () => {
    const song = await counting();
    song.store.getState().scrub(at(2.4));
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerSeek.mock.calls.at(-1)).toEqual([at(2)]);
    expect(counts(song)).toHaveLength(2);
  });

  it('retime entered from pause counts in again at the retime speed', async () => {
    const song = await countingSong();
    song.store.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(counts(song).map(([, beatFrames]) => beatFrames)).toEqual([
      at(BEAT),
      at(BEAT) / RETIME_PLAYBACK_RATE,
    ]);
  });

  it('retime entered mid-count keeps the count, at the retime speed', async () => {
    const song = await counting();
    song.store.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(counts(song).at(-1)?.[1]).toBe(at(BEAT) / RETIME_PLAYBACK_RATE);
  });

  it('a speed put back counts in again at that speed', async () => {
    const song = await countingSong();
    song.store.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    song.store.getState().cancelRetime();
    await vi.runAllTimersAsync();
    expect(counts(song).at(-1)?.[1]).toBe(at(BEAT));
  });

  it('closing the song stops the count and the song together', async () => {
    const song = await counting();
    song.store.getState().close();
    expect(song.commands.songStop).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
  });

  it('closing a count with the click off stops the count and the song together', async () => {
    const song = await counting({ click: false });
    song.store.getState().close();
    expect(song.commands.songStop).toHaveBeenCalledTimes(1);
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
  });

  it('pausing a count with the click off cancels it and arms no click', async () => {
    const song = await counting({ click: false });
    song.store.getState().togglePlay();
    expect(song.commands.songPause).toHaveBeenCalledTimes(1);
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
  });
});

describe('after the count', () => {
  it('a seek leaves the song playing', async () => {
    const song = await counting();
    song.engine.now = COUNT_END;
    song.engine.playing = true;
    song.store.getState().seek(at(2.4));
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(counts(song)).toHaveLength(1);
  });

  it('pause pauses the song alone, the click following it', async () => {
    const song = await counting();
    song.engine.now = COUNT_END;
    song.engine.playing = true;
    song.store.getState().togglePlay();
    expect(song.commands.mixerPause).toHaveBeenCalledTimes(1);
    expect(song.commands.songPause).not.toHaveBeenCalled();
  });

  it('closing a song counted in with the click off stops the song alone', async () => {
    const song = await counting({ click: false });
    song.engine.now = COUNT_END;
    song.store.getState().close();
    expect(song.commands.mixerStop).toHaveBeenCalledTimes(1);
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.metronomeStop).not.toHaveBeenCalled();
  });

  it('turning the click on locks it to the song at once', async () => {
    const song = await counting({ click: false });
    song.engine.now = COUNT_END;
    await song.store.getState().toggleClick();
    expect(song.commands.metronomeStart).toHaveBeenCalledWith(COUNT_END);
    expect(counts(song)).toHaveLength(1);
  });

  it('closing stops the song as before', async () => {
    const song = await counting();
    song.engine.now = COUNT_END;
    song.store.getState().close();
    expect(song.commands.mixerStop).toHaveBeenCalledTimes(1);
    expect(song.commands.songStop).not.toHaveBeenCalled();
  });
});

describe('with the metronome tool counting in beside a paused song', () => {
  async function besideMetronome() {
    const song = await countingSong({ click: false });
    song.sharedMetronome.active.mockReturnValue(true);
    return song;
  }

  it('a seek leaves the metronome and the song alone', async () => {
    const song = await besideMetronome();
    song.store.getState().seek(at(2.4));
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(counts(song)).toHaveLength(0);
  });

  it('closing leaves the metronome alone', async () => {
    const song = await besideMetronome();
    song.store.getState().close();
    expect(song.commands.songStop).not.toHaveBeenCalled();
    expect(song.commands.metronomeStop).not.toHaveBeenCalled();
    expect(song.commands.mixerStop).toHaveBeenCalledTimes(1);
  });

  it('play starts the song rather than pausing the metronome', async () => {
    const song = await besideMetronome();
    song.store.getState().togglePlay();
    expect(song.commands.songPause).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
  });
});
