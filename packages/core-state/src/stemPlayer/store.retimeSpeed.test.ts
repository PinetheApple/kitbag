import { KB_MIXER_RATE_BOUNDS, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETIME_PLAYBACK_RATE } from './retimeSpeed.ts';
import { at, BARS, opened, SONG_DETAILS, stem } from './store.test-helper.ts';

const OTHER_SONG_ID = 8;
const SONG_SPEED = 0.9;
const SLOWER_THAN_RETIME = 0.6;

type Song = Awaited<ReturnType<typeof opened>>;

function settle() {
  return vi.runAllTimersAsync();
}

async function songAt(speed = SONG_SPEED) {
  const song = await opened([stem(1)], SONG_DETAILS);
  song.commands.mixerRate.mockResolvedValue(speed);
  return song;
}

async function retiming(speed = SONG_SPEED) {
  const song = await songAt(speed);
  song.store.getState().beginRetime(0);
  await settle();
  return song;
}

function ratesSet({ commands }: Song) {
  return commands.mixerSetRate.mock.calls.map(([rate]) => rate);
}

function playbackRate({ store }: Song) {
  const { retime } = store.getState();
  return retime.kind === 'recording' ? retime.playbackRate : undefined;
}

function silenceWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the retime speed', () => {
  it('is a speed the mixer plays', () => {
    expect(RETIME_PLAYBACK_RATE).toBeGreaterThanOrEqual(
      KB_MIXER_RATE_BOUNDS.min,
    );
    expect(RETIME_PLAYBACK_RATE).toBeLessThanOrEqual(KB_MIXER_RATE_BOUNDS.max);
  });
});

describe('entering retime', () => {
  it('reads the speed playing and slows to the retime speed once', async () => {
    const song = await retiming();
    expect(song.commands.mixerRate).toHaveBeenCalledOnce();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE]);
    expect(playbackRate(song)).toBe(RETIME_PLAYBACK_RATE);
  });

  it('claims no speed until the mixer took it', async () => {
    const song = await songAt();
    song.store.getState().beginRetime(0);
    expect(playbackRate(song)).toBeNull();
    await settle();
    expect(playbackRate(song)).toBe(RETIME_PLAYBACK_RATE);
  });

  it.each([SLOWER_THAN_RETIME, RETIME_PLAYBACK_RATE])(
    'keeps a song already at %s, on entry and exit',
    async (speed) => {
      const song = await retiming(speed);
      expect(playbackRate(song)).toBe(speed);
      song.store.getState().cancelRetime();
      await settle();
      expect(ratesSet(song)).toEqual([]);
    },
  );

  it('changes no speed on taps, undo or shift', async () => {
    const song = await retiming();
    song.engine.position = at(1.25);
    song.store.getState().tapRetime();
    song.store.getState().undoRetimeTap();
    song.store.getState().shiftRetime(1);
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE]);
    expect(song.commands.mixerRate).toHaveBeenCalledOnce();
  });
});

describe('every way out of retime restores the speed it found', () => {
  const exits: [string, (song: Song) => unknown][] = [
    [
      'save',
      (song) => {
        song.engine.position = at(1.25);
        song.store.getState().tapRetime();
        return song.store.getState().commitRetime();
      },
    ],
    [
      'save with nothing changed',
      (song) => song.store.getState().commitRetime(),
    ],
    [
      'cancel',
      (song) => {
        song.store.getState().cancelRetime();
      },
    ],
    ['reset', (song) => song.store.getState().resetRetime()],
    [
      'close',
      (song) => {
        song.store.getState().close();
      },
    ],
    ['another song', (song) => song.store.getState().open(OTHER_SONG_ID, BARS)],
    [
      'an Activity relaunch',
      (song) => {
        song.store.getState().acquireSong(7, BARS)();
      },
    ],
  ];

  it.each(exits)('%s', async (_, leave) => {
    const song = await retiming();
    await leave(song);
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE, SONG_SPEED]);
  });

  it('a relaunch whose old screen lets go late', async () => {
    const song = await songAt();
    const releaseOld = song.store.getState().acquireSong(7, BARS);
    await settle();
    song.store.getState().beginRetime(0);
    await settle();
    const releaseNew = song.store.getState().acquireSong(7, BARS);
    releaseOld();
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE, SONG_SPEED]);
    releaseNew();
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE, SONG_SPEED]);
  });

  it('restores after a slow-down still in flight when retime ends', async () => {
    const song = await songAt();
    let finish: (result: number) => void = () => undefined;
    song.commands.mixerSetRate.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    song.store.getState().beginRetime(0);
    await settle();
    song.store.getState().cancelRetime();
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE]);
    finish(KB_RESULT.KB_OK);
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE, SONG_SPEED]);
  });

  it('does not slow when retime ends before the speed was read', async () => {
    const song = await songAt();
    song.store.getState().beginRetime(0);
    song.store.getState().cancelRetime();
    await settle();
    expect(ratesSet(song)).toEqual([]);
  });

  it('does not mark a later retime with an earlier one’s speed', async () => {
    silenceWarnings();
    const song = await songAt();
    let finish: (result: number) => void = () => undefined;
    song.commands.mixerSetRate
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(KB_RESULT.KB_OK)
      .mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    song.store.getState().beginRetime(0);
    await settle();
    song.store.getState().cancelRetime();
    song.store.getState().beginRetime(0);
    finish(KB_RESULT.KB_OK);
    await settle();
    expect(ratesSet(song)).toEqual([
      RETIME_PLAYBACK_RATE,
      SONG_SPEED,
      RETIME_PLAYBACK_RATE,
    ]);
    expect(playbackRate(song)).toBeNull();
  });

  it('sets nothing on a close with no retime', async () => {
    const song = await songAt();
    song.store.getState().close();
    await settle();
    expect(ratesSet(song)).toEqual([]);
  });
});

describe('a speed change the mixer refuses', () => {
  it.each([
    [
      'answers an error',
      () => Promise.resolve<number>(KB_RESULT.KB_ERROR_BUSY),
    ],
    ['throws', () => Promise.reject(new Error('no engine'))],
  ])('keeps the old speed and claims nothing when it %s', async (_, fail) => {
    const warn = silenceWarnings();
    const song = await songAt();
    song.commands.mixerSetRate.mockImplementationOnce(fail);
    song.store.getState().beginRetime(0);
    await settle();
    expect(playbackRate(song)).toBeNull();
    song.store.getState().cancelRetime();
    await settle();
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE]);
    expect(warn).toHaveBeenCalled();
  });

  it('does not slow when the speed playing cannot be read', async () => {
    silenceWarnings();
    const song = await songAt();
    song.commands.mixerRate.mockRejectedValueOnce(new Error('no engine'));
    song.store.getState().beginRetime(0);
    await settle();
    expect(ratesSet(song)).toEqual([]);
    expect(playbackRate(song)).toBeNull();
  });

  it('does not slow when the speed read is not one it could restore', async () => {
    silenceWarnings();
    const song = await retiming(0);
    expect(ratesSet(song)).toEqual([]);
  });

  it('owes a refused restore to the next exit, not to the stuck speed', async () => {
    silenceWarnings();
    const song = await retiming();
    song.commands.mixerSetRate.mockResolvedValueOnce(KB_RESULT.KB_ERROR_BUSY);
    song.store.getState().cancelRetime();
    await settle();
    song.commands.mixerRate.mockResolvedValue(RETIME_PLAYBACK_RATE);
    song.store.getState().beginRetime(0);
    await settle();
    song.store.getState().cancelRetime();
    await settle();
    expect(ratesSet(song)).toEqual([
      RETIME_PLAYBACK_RATE,
      SONG_SPEED,
      RETIME_PLAYBACK_RATE,
      SONG_SPEED,
    ]);
    expect(song.commands.mixerRate).toHaveBeenCalledOnce();
  });
});

describe('what a slowed retime stores', () => {
  it('saves only line times, in song time, and never a speed', async () => {
    const song = await retiming();
    song.engine.position = at(1.25);
    song.store.getState().tapRetime();
    song.engine.position = at(3.75);
    song.store.getState().tapRetime();
    await song.store.getState().commitRetime();
    await settle();
    expect(song.records.saveLyricsRetimed).toHaveBeenCalledExactlyOnceWith(
      7,
      [1.25, 2.25, 3.75, 5.75],
    );
    expect(song.records.saveStemMix).not.toHaveBeenCalled();
  });
});
