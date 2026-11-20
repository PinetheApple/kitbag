import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { at } from '../stemPlayer/store.test-helper.ts';
import { BEAT, counts, songWithCountIn } from './countIn.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  openedSong,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const SLOWED = 0.9;
const HALF = 0.5;
const STEM_SONG_SPEED = 0.75;
const BELOW_RANGE = 0.3;
const ABOVE_RANGE = 1.4;

const ratesSet = (song: Awaited<ReturnType<typeof openedSong>>) =>
  song.commands.mixerSetRate.mock.calls.map(([rate]) => rate);

async function openAfterStemSong(saved: number) {
  const fake = fakeSongRuntime(songRecord({ speed: saved }));
  fake.engine.rate = STEM_SONG_SPEED;
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  return { ...fake, store };
}

describe('song speed on open', () => {
  it('opens at the speed saved for the song', async () => {
    const song = await openedSong(songRecord({ speed: SLOWED }));
    expect(song.store.getState().speed).toBe(SLOWED);
    expect(song.engine.rate).toBe(SLOWED);
  });

  it("starts at the song's own full speed after a slowed stem song", async () => {
    const song = await openAfterStemSong(1);
    expect(song.store.getState().speed).toBe(1);
    expect(song.engine.rate).toBe(1);
  });

  it("starts at the song's own saved speed after a stem song at another", async () => {
    const song = await openAfterStemSong(SLOWED);
    expect(ratesSet(song)).toEqual([1, SLOWED]);
    expect(song.engine.rate).toBe(SLOWED);
  });
});

describe('reattaching a song', () => {
  it('keeps its speed without setting the rate again', async () => {
    const song = await openedSong(songRecord({ speed: SLOWED }));
    song.commands.mixerSetRate.mockClear();
    await song.store.getState().open(SONG_ID, BARS).loaded;
    expect(song.store.getState().speed).toBe(SLOWED);
    expect(song.commands.mixerSetRate).not.toHaveBeenCalled();
  });
});

describe('changing song speed', () => {
  it('plays the new speed and saves it for the song', async () => {
    const song = await openedSong();
    await song.store.getState().setSpeed(SLOWED);
    expect(song.engine.rate).toBe(SLOWED);
    expect(song.store.getState().speed).toBe(SLOWED);
    expect(song.records.saveSongSpeed).toHaveBeenCalledWith(SONG_ID, SLOWED);
  });

  it.each([
    [BELOW_RANGE, HALF],
    [ABOVE_RANGE, 1],
  ])('keeps %s inside the engine range as %s', async (asked, played) => {
    const song = await openedSong(songRecord({ speed: SLOWED }));
    await song.store.getState().setSpeed(asked);
    expect(song.store.getState().speed).toBe(played);
  });

  it('keeps the old speed and saves nothing when the engine refuses', async () => {
    const song = await openedSong();
    song.commands.mixerSetRate.mockResolvedValueOnce(
      KB_RESULT.KB_ERROR_INTERNAL,
    );
    await song.store.getState().setSpeed(SLOWED);
    expect(song.store.getState().speed).toBe(1);
    expect(song.records.saveSongSpeed).not.toHaveBeenCalled();
  });

  it('resets to full speed and saves that', async () => {
    const song = await openedSong(songRecord({ speed: SLOWED }));
    await song.store.getState().resetSpeed();
    expect(song.engine.rate).toBe(1);
    expect(song.records.saveSongSpeed).toHaveBeenCalledWith(SONG_ID, 1);
  });
});

describe('the count-in at a song speed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts beats as long as the slowed song plays them', async () => {
    const song = await songWithCountIn(1, {
      record: songRecord({ speed: HALF }),
    });
    song.store.getState().togglePlay();
    expect(counts(song)[0]?.[1]).toBe(at(BEAT) / HALF);
  });

  it('restarts a count in progress at the new speed, without starting the song', async () => {
    const song = await songWithCountIn();
    song.store.getState().togglePlay();
    await song.store.getState().setSpeed(HALF);
    expect(counts(song).map(([, beatFrames]) => beatFrames)).toEqual([
      at(BEAT),
      at(BEAT) / HALF,
    ]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('follows a speed changed after the song opened', async () => {
    const song = await songWithCountIn();
    await song.store.getState().setSpeed(HALF);
    song.store.getState().togglePlay();
    expect(counts(song)[0]?.[1]).toBe(at(BEAT) / HALF);
  });
});
