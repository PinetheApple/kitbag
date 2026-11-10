import { KB_COUNT_IN_OFF, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNT_IN_DRAIN_MARGIN_SECONDS } from './countedStart.ts';
import { RETIME_PLAYBACK_RATE } from './retimeSpeed.ts';
import { at, opened, SONG_DETAILS, stem } from './store.test-helper.ts';

const ONE_BAR = 1;
const TWO_FOUR = [{ beat: 0, beatsPerBar: 2 }];
const BEAT = 0.5;
const BAR_BEATS = 2;
const HEAD = at(1.2);
const BAR_AT_HEAD = at(1);
const COUNT_END =
  at(COUNT_IN_DRAIN_MARGIN_SECONDS) + ONE_BAR * BAR_BEATS * at(BEAT);
const SONG_END = at(10);

type Song = Awaited<ReturnType<typeof opened>>;

async function countingSong({ click = true } = {}) {
  const song = await opened([stem(1)], { ...SONG_DETAILS, bars: TWO_FOUR });
  song.countInBars.mockReturnValue(ONE_BAR);
  if (click) await song.store.getState().toggleClick();
  song.engine.position = HEAD;
  vi.clearAllMocks();
  return song;
}

async function counting() {
  const song = await countingSong();
  song.store.getState().togglePlay();
  await vi.runAllTimersAsync();
  return song;
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
    expect(counts(song)).toEqual([[COUNT_END, at(BEAT), BAR_BEATS]]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it.each([
    ['the click is off', { click: false }, ONE_BAR],
    ['the count-in is off', { click: true }, KB_COUNT_IN_OFF],
  ])('plays at once when %s', async (_, options, bars) => {
    const song = await countingSong(options);
    song.countInBars.mockReturnValue(bars);
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
    expect(counts(song)).toEqual([[COUNT_END, at(BEAT), BAR_BEATS]]);
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

  it('turning the click off starts the song now', async () => {
    const song = await counting();
    await song.store.getState().toggleClick();
    expect(song.commands.metronomeStop).toHaveBeenCalledTimes(1);
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
