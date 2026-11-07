import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SKIP_SECONDS } from '../stemPlayer/songTransport.ts';
import { RATE } from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  openedSong,
  SEEK_MS,
  SONG_ID,
  songRecord,
  songStore,
  type Fake,
} from './store.test-helper.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('opening a song', () => {
  it('plays it as track 0 of the mixer', async () => {
    const { store, commands } = await openedSong();
    expect(commands.loadTrack).toHaveBeenCalledExactlyOnceWith(
      0,
      'songs/u/everlong.mp3',
    );
    expect(store.getState()).toMatchObject({
      status: 'ready',
      songId: SONG_ID,
      title: 'Everlong',
      artist: 'Foo',
      bpm: 120,
      engineRate: RATE,
      durationFrames: RATE * 10,
      downbeatIndices: [0, 4],
    });
  });

  it('reads the waveform at the bars asked for', async () => {
    const { store, readWaveform } = await openedSong();
    await vi.waitFor(() => {
      expect(store.getState().envelope).toEqual([0.5]);
    });
    expect(readWaveform).toHaveBeenCalledWith('songs/u/everlong.kwav', BARS);
  });

  it('opens a song with no waveform yet', async () => {
    const { store, readWaveform } = await openedSong(
      songRecord({ waveformPath: null }),
    );
    expect(store.getState().status).toBe('ready');
    expect(readWaveform).not.toHaveBeenCalled();
  });

  it('stays usable when the waveform cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeSongRuntime();
    fake.readWaveform.mockRejectedValueOnce(new Error('torn'));
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    expect(store.getState().status).toBe('ready');
    expect(store.getState().envelope).toBeNull();
    warn.mockRestore();
  });

  it('drops a waveform that lands after the song was closed', async () => {
    const fake = fakeSongRuntime();
    let landed: (envelope: readonly number[]) => void = () => undefined;
    fake.readWaveform.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landed = resolve;
        }),
    );
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    store.getState().close();
    landed([0.9]);
    await Promise.resolve();
    expect(store.getState().envelope).toBeNull();
  });

  it('reports a song that is gone', async () => {
    const fake = fakeSongRuntime();
    fake.records.readSong.mockResolvedValueOnce(undefined);
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().status).toBe('missing');
    expect(fake.commands.loadTrack).not.toHaveBeenCalled();
  });

  it.each<[string, (fake: Fake) => void]>([
    [
      'the engine will not start',
      (fake) => {
        fake.commands.start.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
      },
    ],
    [
      'the record cannot be read',
      (fake) => {
        fake.records.readSong.mockRejectedValueOnce(new Error('locked'));
      },
    ],
    [
      'the file will not decode',
      (fake) => {
        fake.commands.loadTrack.mockResolvedValueOnce(
          KB_RESULT.KB_ERROR_INTERNAL,
        );
      },
    ],
    [
      'the file load throws',
      (fake) => {
        fake.commands.loadTrack.mockRejectedValueOnce(new Error('unsafe path'));
      },
    ],
  ])('reports a failure when %s', async (_, arrange) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeSongRuntime();
    arrange(fake);
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().status).toBe('failed');
    warn.mockRestore();
  });

  it('keeps the title for a file that will not decode', async () => {
    const fake = fakeSongRuntime();
    fake.commands.loadTrack.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().title).toBe('Everlong');
  });

  it('shows no artist for a song without one', async () => {
    const { store } = await openedSong(songRecord({ artist: '' }));
    expect(store.getState().artist).toBeNull();
  });

  it('stops the metronome tool before it takes the shared metronome', async () => {
    const fake = fakeSongRuntime();
    fake.sharedMetronome.active.mockReturnValue(true);
    await songStore(fake).getState().open(SONG_ID, BARS).loaded;
    expect(fake.sharedMetronome.release).toHaveBeenCalledOnce();
    expect(
      fake.sharedMetronome.release.mock.invocationCallOrder[0],
    ).toBeLessThan(
      fake.commands.start.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('loads nothing for a song left while its old loop was being cleared', async () => {
    const fake = fakeSongRuntime();
    let cleared: (code: number) => void = () => undefined;
    fake.commands.mixerClearLoop.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          cleared = resolve;
        }),
    );
    const store = songStore(fake);
    const opening = store.getState().open(SONG_ID, BARS).loaded;
    await vi.waitFor(() => {
      expect(fake.commands.mixerClearLoop).toHaveBeenCalled();
    });
    store.getState().close();
    cleared(KB_RESULT.KB_OK);
    await opening;
    expect(fake.commands.loadTrack).not.toHaveBeenCalled();
  });

  it('replaces the open song when another one opens', async () => {
    const { store, commands } = await openedSong();
    await store.getState().open(SONG_ID + 1, BARS).loaded;
    expect(commands.loadTrack).toHaveBeenCalledTimes(2);
    expect(commands.mixerUnloadTrack.mock.invocationCallOrder[0]).toBeLessThan(
      commands.loadTrack.mock.invocationCallOrder[1] ?? Number.NaN,
    );
    expect(store.getState().songId).toBe(SONG_ID + 1);
  });
});

describe('a song whose metadata gives no duration', () => {
  it('is ready with no length, which pins every seek to the start', async () => {
    const { store, commands, engine } = await openedSong(
      songRecord({ durationSec: 0 }),
    );
    expect(store.getState()).toMatchObject({
      status: 'ready',
      durationFrames: 0,
    });
    engine.position = RATE;
    store.getState().skip(SKIP_SECONDS);
    expect(commands.mixerSeek).toHaveBeenLastCalledWith(0);
  });
});

describe('the transport', () => {
  it('plays and pauses on the engine truth, not a store copy', async () => {
    const { store, commands, engine } = await openedSong();
    store.getState().togglePlay();
    expect(commands.mixerPlay).toHaveBeenCalledOnce();
    engine.playing = true;
    store.getState().togglePlay();
    expect(commands.mixerPause).toHaveBeenCalledOnce();
  });

  it('starts over when pressed at the end of the song', async () => {
    const { store, commands, engine } = await openedSong();
    engine.position = RATE * 10;
    store.getState().togglePlay();
    expect(commands.mixerSeek).toHaveBeenCalledWith(0);
  });

  it('skips by the shared step and stays inside the song', async () => {
    const { store, commands, engine } = await openedSong();
    engine.position = RATE;
    store.getState().skip(-SKIP_SECONDS);
    expect(commands.mixerSeek).toHaveBeenLastCalledWith(0);
    store.getState().skip(SKIP_SECONDS);
    expect(commands.mixerSeek).toHaveBeenLastCalledWith(RATE * 10);
  });

  it('holds a scrub back until it settles', async () => {
    const { store, commands } = await openedSong();
    store.getState().scrub(RATE);
    expect(commands.mixerSeek).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SEEK_MS);
    expect(commands.mixerSeek).toHaveBeenCalledWith(RATE);
  });
});

describe('the loop', () => {
  it('snaps both ends to the grid', async () => {
    const { store, commands, engine } = await openedSong();
    engine.position = RATE * 0.6;
    await store.getState().markLoop();
    engine.position = RATE * 1.4;
    await store.getState().markLoop();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(RATE * 0.5, RATE * 1.5);
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 0.5,
      endSec: 1.5,
    });
  });

  it('runs unsnapped on a song with no grid', async () => {
    const { store, commands, engine } = await openedSong(
      songRecord({ beats: [], downbeatIndices: [] }),
    );
    engine.position = RATE * 0.6;
    await store.getState().markLoop();
    engine.position = RATE * 1.4;
    await store.getState().markLoop();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(
      Math.round(RATE * 0.6),
      Math.round(RATE * 1.4),
    );
  });

  it('clears the loop it set when the song closes', async () => {
    const { store, commands, engine } = await openedSong();
    engine.position = RATE;
    await store.getState().markLoop();
    engine.position = RATE * 2;
    await store.getState().markLoop();
    store.getState().close();
    expect(commands.mixerClearLoop).toHaveBeenCalledOnce();
  });
});

describe('the click', () => {
  it('follows the mixer on the song grid', async () => {
    const { store, commands } = await openedSong();
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(songRecord().beats, 0);
    expect(commands.metronomeFollowMixer).toHaveBeenCalledWith(true);
    expect(commands.metronomeStart).toHaveBeenCalledOnce();
    expect(store.getState().click).toBe(true);
  });

  it('does not start without a grid', async () => {
    const { store, commands } = await openedSong(
      songRecord({ beats: [], downbeatIndices: [] }),
    );
    await store.getState().toggleClick();
    expect(commands.setGrid).not.toHaveBeenCalled();
    expect(store.getState().click).toBe(false);
  });

  it('clears the grid and the follow when the song closes', async () => {
    const { store, commands } = await openedSong();
    await store.getState().toggleClick();
    store.getState().close();
    expect(commands.clearGrid).toHaveBeenCalledOnce();
    expect(commands.metronomeFollowMixer).toHaveBeenLastCalledWith(false);
    expect(commands.metronomeStop).toHaveBeenCalledOnce();
  });

  it('turns off when the notification stops the song', async () => {
    const { store, commands, stopSongFromNotification } = await openedSong();
    await store.getState().toggleClick();
    stopSongFromNotification();
    expect(store.getState().click).toBe(false);
    expect(commands.clearGrid).toHaveBeenCalledOnce();
  });
});

describe('closing', () => {
  it('stops and unloads the mixer and lets go of the engine', async () => {
    const { store, commands, songStopListeners } = await openedSong();
    store.getState().close();
    expect(commands.mixerStop).toHaveBeenCalledOnce();
    expect(commands.mixerUnloadTrack).toHaveBeenCalledWith(0);
    expect(commands.songTransportHide).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
    expect(songStopListeners.size).toBe(0);
    expect(store.getState().status).toBe('idle');
    expect(store.getState().songId).toBeNull();
  });

  it.each<[string, (fake: Fake) => void]>([
    [
      'missing',
      (fake) => {
        fake.records.readSong.mockResolvedValueOnce(undefined);
      },
    ],
    [
      'failed',
      (fake) => {
        fake.commands.loadTrack.mockResolvedValueOnce(
          KB_RESULT.KB_ERROR_INTERNAL,
        );
      },
    ],
  ])('lets go of the engine when a %s song closes', async (status, arrange) => {
    const fake = fakeSongRuntime();
    arrange(fake);
    const store = songStore(fake);
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().status).toBe(status);
    store.getState().close();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
    expect(fake.songStopListeners.size).toBe(0);
  });

  it('touches nothing the second time', async () => {
    const { store, commands } = await openedSong();
    store.getState().close();
    store.getState().close();
    expect(commands.mixerStop).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });
});
