import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetronomeCommands } from '../metronome/commands.ts';
import { configureMetronomeRuntime } from '../metronome/runtime.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { createStemPlayerStore } from '../stemPlayer/store.ts';
import {
  fakeRuntime as fakeStemRuntime,
  record,
  stem,
} from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songStore,
  type Fake,
} from './store.test-helper.ts';

const STEM_SET_ID = 7;
const STEM_MASTER = 0.4;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function storesSharingOneMixer() {
  const mixerClaim = createMixerClaim();
  const songFake = fakeSongRuntime();
  const stemFake = fakeStemRuntime(record([stem(1)]));
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
    await songs.getState().open(SONG_ID, BARS).loaded;
    expect(stemSongs.getState().setId).toBeNull();
    expect(stemFake.commands.mixerStop).toHaveBeenCalledOnce();
    expect(songs.getState().status).toBe('ready');
  });

  it('closes an open song when a stem song opens', async () => {
    const { songs, stemSongs, songFake } = storesSharingOneMixer();
    await songs.getState().open(SONG_ID, BARS).loaded;
    await stemSongs.getState().open(STEM_SET_ID, BARS);
    expect(songs.getState().songId).toBeNull();
    expect(songFake.commands.mixerStop).toHaveBeenCalledOnce();
    expect(stemSongs.getState().status).toBe('ready');
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
    second.hold.release();
    expect(store.getState().status).toBe('idle');
  });

  it('closes its own session', async () => {
    const fake = fakeSongRuntime();
    const store = songStore(fake);
    const session = store.getState().open(SONG_ID, BARS);
    await session.loaded;
    session.hold.release();
    expect(store.getState().songId).toBeNull();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
  });
});

describe('the standalone metronome', () => {
  const TEMPO = 97;

  function runMetronomeBeside(song: Fake) {
    configureMetronomeRuntime({
      commands: new Proxy(song.commands, {
        get: (commands, name) =>
          (Reflect.get(commands, name) as unknown) ?? (() => undefined),
      }) as unknown as MetronomeCommands,
      nowFrame: () => 0,
      engineBpm: () => TEMPO,
    });
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
    const after = metronomeStore.getState();
    expect(after.running).toBe(false);
    expect(configOf(after)).toEqual(configOf(before));
    expect(after.bpm).toBe(TEMPO);
    expect(after.beatsPerBar).toBe(3);
    for (const setter of Object.values(song.metronomeSetters)) {
      expect(setter).not.toHaveBeenCalled();
    }
  });
});
