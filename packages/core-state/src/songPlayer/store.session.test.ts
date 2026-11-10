import type { StemSetRecord } from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetronomeCommands } from '../metronome/commands.ts';
import { configureMetronomeRuntime } from '../metronome/runtime.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { RETIME_PLAYBACK_RATE } from '../stemPlayer/retimeSpeed.ts';
import { createStemPlayerStore } from '../stemPlayer/store.ts';
import {
  fakeRuntime as fakeStemRuntime,
  RATE,
  record,
  SONG_DETAILS,
  stem,
} from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songRecord,
  songStore,
  type Fake,
} from './store.test-helper.ts';

const STEM_SET_ID = 7;
const STEM_MASTER = 0.4;
const AUDIO_BLOCK_MS = 10;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function storesSharingOneMixer(details: Partial<StemSetRecord> = {}) {
  const mixerClaim = createMixerClaim();
  const songFake = fakeSongRuntime();
  const stemFake = fakeStemRuntime(record([stem(1)], details));
  const songs = songStore(songFake, mixerClaim);
  const stemSongs = createStemPlayerStore(() => stemFake.runtime, {
    mixerClaim,
  });
  return { songFake, stemFake, songs, stemSongs };
}

function sharedMaster({
  songFake,
  stemFake,
}: Pick<ReturnType<typeof storesSharingOneMixer>, 'songFake' | 'stemFake'>) {
  const master = { value: STEM_MASTER };
  const read = () => Promise.resolve(master.value);
  const write = (gain: number) => {
    master.value = gain;
  };
  for (const { commands } of [songFake, stemFake]) {
    commands.mixerMasterGain.mockImplementation(read);
    commands.mixerSetMasterGain.mockImplementation(write);
  }
  return master;
}

function pendingLoad(fake: {
  commands: ReturnType<typeof fakeStemRuntime>['commands'];
}) {
  let finish: (code: number) => void = () => undefined;
  fake.commands.loadTrack.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  return (code: number) => {
    finish(code);
  };
}

describe('sharing the mixer with stem songs', () => {
  it('closes an open stem song when a song opens', async () => {
    const { songs, stemSongs, stemFake } = storesSharingOneMixer();
    await stemSongs.getState().open(STEM_SET_ID, BARS);
    stemFake.commands.mixerStop.mockClear();
    await songs.getState().open(SONG_ID, BARS).loaded;
    expect(stemSongs.getState().setId).toBeNull();
    expect(stemFake.commands.mixerStop).toHaveBeenCalledOnce();
    expect(songs.getState().status).toBe('ready');
  });

  it('closes an open song when a stem song opens', async () => {
    const { songs, stemSongs, songFake } = storesSharingOneMixer();
    await songs.getState().open(SONG_ID, BARS).loaded;
    songFake.commands.mixerStop.mockClear();
    await stemSongs.getState().open(STEM_SET_ID, BARS);
    expect(songs.getState().songId).toBeNull();
    expect(songFake.commands.mixerStop).toHaveBeenCalledOnce();
    expect(stemSongs.getState().status).toBe('ready');
  });

  it('reloads a song a stem song displaced when it opens again', async () => {
    const { songs, stemSongs, songFake } = storesSharingOneMixer();
    const first = songs.getState().open(SONG_ID, BARS);
    await first.loaded;
    await stemSongs.getState().open(STEM_SET_ID, BARS);
    const again = songs.getState().open(SONG_ID, BARS);
    await again.loaded;
    expect(songFake.commands.loadTrack).toHaveBeenCalledTimes(2);
    expect(first.hold.live()).toBe(false);
    expect(again.hold.live()).toBe(true);
    expect(stemSongs.getState().setId).toBeNull();
    expect(songs.getState()).toMatchObject({
      songId: SONG_ID,
      status: 'ready',
    });
  });

  it('keeps the song playing when the displaced stem screen closes late', async () => {
    const { songs, stemSongs, stemFake } = storesSharingOneMixer();
    await stemSongs.getState().open(STEM_SET_ID, BARS);
    await songs.getState().open(SONG_ID, BARS).loaded;
    stemFake.commands.mixerStop.mockClear();
    stemSongs.getState().close();
    expect(stemFake.commands.mixerStop).not.toHaveBeenCalled();
    expect(songs.getState().status).toBe('ready');
  });

  it('drops a stem song displaced with its load in flight', async () => {
    const { songs, stemSongs, stemFake } = storesSharingOneMixer();
    const finishStemLoad = pendingLoad(stemFake);
    const stemOpening = stemSongs.getState().open(STEM_SET_ID, BARS);
    await vi.waitFor(() => {
      expect(stemFake.commands.loadTrack).toHaveBeenCalled();
    });
    await songs.getState().open(SONG_ID, BARS).loaded;
    stemFake.commands.mixerSetGain.mockClear();
    finishStemLoad(KB_RESULT.KB_OK);
    await stemOpening;
    expect(stemSongs.getState().status).toBe('idle');
    expect(stemFake.commands.mixerSetGain).not.toHaveBeenCalled();
    expect(songs.getState().status).toBe('ready');
  });
});

describe('the master level a stem song left behind', () => {
  it('plays the song at full level and puts it back on close', async () => {
    const stores = storesSharingOneMixer();
    const master = sharedMaster(stores);
    await stores.songs.getState().open(SONG_ID, BARS).loaded;
    expect(master.value).toBe(1);
    stores.songs.getState().close();
    expect(master.value).toBe(STEM_MASTER);
  });

  it('is restored when the song closes during its load', async () => {
    const stores = storesSharingOneMixer();
    const master = sharedMaster(stores);
    const finishLoad = pendingLoad(stores.songFake);
    const { loaded } = stores.songs.getState().open(SONG_ID, BARS);
    await vi.waitFor(() => {
      expect(stores.songFake.commands.loadTrack).toHaveBeenCalled();
    });
    stores.songs.getState().close();
    expect(master.value).toBe(STEM_MASTER);
    finishLoad(KB_RESULT.KB_OK);
    await loaded;
    expect(master.value).toBe(STEM_MASTER);
  });

  it('is restored when a failed load closes', async () => {
    const stores = storesSharingOneMixer();
    const master = sharedMaster(stores);
    stores.songFake.commands.loadTrack.mockResolvedValueOnce(
      KB_RESULT.KB_ERROR_INTERNAL,
    );
    await stores.songs.getState().open(SONG_ID, BARS).loaded;
    expect(stores.songs.getState().status).toBe('failed');
    stores.songs.getState().close();
    expect(master.value).toBe(STEM_MASTER);
  });

  it('survives one song replacing another in the same store', async () => {
    const stores = storesSharingOneMixer();
    const master = sharedMaster(stores);
    await stores.songs.getState().open(SONG_ID, BARS).loaded;
    await stores.songs.getState().open(SONG_ID + 1, BARS).loaded;
    expect(master.value).toBe(1);
    stores.songs.getState().close();
    expect(master.value).toBe(STEM_MASTER);
  });

  it('is what a stem song opening next reads', async () => {
    const stores = storesSharingOneMixer();
    sharedMaster(stores);
    await stores.songs.getState().open(SONG_ID, BARS).loaded;
    await stores.stemSongs.getState().open(STEM_SET_ID, BARS);
    expect(stores.stemSongs.getState().masterGain).toBe(STEM_MASTER);
  });
});

function pendingLength(fake: Fake) {
  let finish: (frames: number) => void = () => undefined;
  fake.commands.mixerTrackFrames.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  return (frames: number) => {
    finish(frames);
  };
}

describe('a length read that fails or lands late', () => {
  const LENGTH = 9 * RATE;

  it('fails the song when the read throws, and closing still cleans up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const stores = storesSharingOneMixer();
    const master = sharedMaster(stores);
    stores.songFake.commands.mixerTrackFrames.mockRejectedValueOnce(
      new Error('torn'),
    );
    await stores.songs.getState().open(SONG_ID, BARS).loaded;
    expect(stores.songs.getState().status).toBe('failed');
    stores.songs.getState().close();
    expect(
      stores.songFake.commands.mixerUnloadTrack,
    ).toHaveBeenCalledExactlyOnceWith(0);
    expect(master.value).toBe(STEM_MASTER);
    warn.mockRestore();
  });

  it('writes nothing when the song closes before the read lands', async () => {
    const fake = fakeSongRuntime();
    const finishLength = pendingLength(fake);
    const store = songStore(fake);
    const { loaded } = store.getState().open(SONG_ID, BARS);
    await vi.waitFor(() => {
      expect(fake.commands.mixerTrackFrames).toHaveBeenCalled();
    });
    store.getState().close();
    finishLength(LENGTH);
    await loaded;
    expect(store.getState()).toMatchObject({
      status: 'idle',
      beats: [],
      durationFrames: 0,
    });
    expect(fake.commands.mixerUnloadTrack).toHaveBeenCalledOnce();
  });

  it('leaves the song that replaced it alone when the read lands late', async () => {
    const fake = fakeSongRuntime();
    const newer = songRecord({
      id: SONG_ID + 1,
      beats: [0, 1],
      durationSec: 4,
    });
    fake.records.readSong
      .mockResolvedValueOnce(songRecord())
      .mockResolvedValueOnce(newer);
    const finishLength = pendingLength(fake);
    const store = songStore(fake);
    const first = store.getState().open(SONG_ID, BARS);
    await vi.waitFor(() => {
      expect(fake.commands.mixerTrackFrames).toHaveBeenCalled();
    });
    await store.getState().open(SONG_ID + 1, BARS).loaded;
    const settled = store.getState();
    finishLength(LENGTH);
    await first.loaded;
    expect(store.getState()).toBe(settled);
    expect(settled).toMatchObject({
      status: 'ready',
      songId: SONG_ID + 1,
      beats: newer.beats,
    });
    expect(fake.commands.mixerUnloadTrack).toHaveBeenCalledOnce();
  });
});

describe('a stem song closed in retime', () => {
  const STEM_SPEED = 0.9;

  function sharedRate(
    { songFake, stemFake }: ReturnType<typeof storesSharingOneMixer>,
    initial: number,
  ) {
    const rate = { value: initial };
    songFake.commands.mixerRate.mockImplementation(() =>
      Promise.resolve(rate.value),
    );
    songFake.commands.mixerSetRate.mockImplementation((next: number) => {
      rate.value = next;
      return Promise.resolve<number>(KB_RESULT.KB_OK);
    });
    stemFake.commands.mixerRate.mockImplementation(() =>
      Promise.resolve(rate.value),
    );
    stemFake.commands.mixerSetRate.mockImplementation(
      (next: number) =>
        new Promise<number>((resolve) => {
          setTimeout(() => {
            rate.value = next;
            resolve(KB_RESULT.KB_OK);
          }, AUDIO_BLOCK_MS);
        }),
    );
    return rate;
  }

  async function songAfterRetime(speedBefore: number) {
    const stores = storesSharingOneMixer(SONG_DETAILS);
    await stores.stemSongs.getState().open(STEM_SET_ID, BARS);
    const rate = sharedRate(stores, speedBefore);
    stores.stemSongs.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    const { loaded } = stores.songs.getState().open(SONG_ID, BARS);
    await vi.runAllTimersAsync();
    await loaded;
    return { ...stores, rate };
  }

  it('plays the song at unity after the stem speed is put back', async () => {
    const { songs, rate, stemFake } = await songAfterRetime(STEM_SPEED);
    expect(
      stemFake.commands.mixerSetRate.mock.calls.map(([speed]) => speed),
    ).toEqual([RETIME_PLAYBACK_RATE, STEM_SPEED]);
    expect(rate.value).toBe(KB_MIXER_UNITY_RATE);
    expect(songs.getState().status).toBe('ready');
  });
});

describe('a screen cleaning up late', () => {
  it('does not close the newer song that replaced its own', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const first = store.getState().open(SONG_ID, BARS);
    await first.loaded;
    await store.getState().open(SONG_ID + 1, BARS).loaded;
    fake.commands.mixerStop.mockClear();
    first.hold.release();
    expect(store.getState().songId).toBe(SONG_ID + 1);
    expect(fake.commands.mixerStop).not.toHaveBeenCalled();
  });

  it('does not close a re-push of the same song', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const first = store.getState().open(SONG_ID, BARS);
    await first.loaded;
    const second = store.getState().open(SONG_ID, BARS);
    await second.loaded;
    first.hold.release();
    expect(store.getState().status).toBe('ready');
    expect(second.hold.live()).toBe(true);
  });
});

describe('the standalone metronome', () => {
  const TEMPO = 97;
  const beside: { song: Fake | null } = { song: null };
  const metronomeRuntime = {
    commands: new Proxy(
      {},
      {
        get: (_target, name) =>
          (Reflect.get(beside.song?.commands ?? {}, name) as unknown) ??
          (() => undefined),
      },
    ) as unknown as MetronomeCommands,
    nowFrame: () => 0,
    engineBpm: () => TEMPO,
  };

  function runMetronomeBeside(song: Fake) {
    beside.song = song;
    configureMetronomeRuntime(metronomeRuntime);
    const metronome = metronomeStore.getState();
    metronome.setTempo(TEMPO);
    metronome.setBeats(3, 4);
    metronome.start();
    song.sharedMetronome.active.mockImplementation(
      () => metronomeStore.getState().running,
    );
    song.sharedMetronome.release.mockImplementation(() => {
      metronomeStore.getState().stop();
    });
    vi.clearAllMocks();
  }

  // Stopping is what changes these two: running, and practice follows it.
  function configOf(state: MetronomeStore) {
    return { ...state, running: undefined, practice: undefined };
  }

  function expectStoppedAndIntact(song: Fake, before: MetronomeStore) {
    const after = metronomeStore.getState();
    expect(after.running).toBe(false);
    expect(configOf(after)).toEqual(configOf(before));
    expect(after.bpm).toBe(TEMPO);
    expect(after.beatsPerBar).toBe(3);
    for (const setter of Object.values(song.metronomeSetters)) {
      expect(setter).not.toHaveBeenCalled();
    }
  }

  it('keeps its tempo and config through a song, but is left stopped', async () => {
    const song = fakeSongRuntime();
    runMetronomeBeside(song);
    const before = metronomeStore.getState();
    expect(before.running).toBe(true);
    const store = songStore(song);
    await store.getState().open(SONG_ID, BARS).loaded;
    await store.getState().toggleClick();
    expect(store.getState().click).toBe(true);
    store.getState().close();
    expectStoppedAndIntact(song, before);
  });

  it('stays stopped and intact while the song outlives its player, and after it closes', async () => {
    const song = fakeSongRuntime();
    runMetronomeBeside(song);
    const before = metronomeStore.getState();
    const store = songStore(song);
    const session = store.getState().open(SONG_ID, BARS);
    await session.loaded;
    await store.getState().toggleClick();
    session.hold.release();
    expect(store.getState().click).toBe(true);
    expectStoppedAndIntact(song, before);
    store.getState().close();
    expectStoppedAndIntact(song, before);
  });
});
