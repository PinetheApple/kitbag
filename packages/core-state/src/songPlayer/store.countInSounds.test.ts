import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { KB_SOUND_NAMES } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { at } from '../stemPlayer/store.test-helper.ts';
import {
  countEnd,
  counts,
  ONE_BAR,
  SEEK_IN_BAR_TWO,
  songWithCountIn,
  type Song,
} from './countIn.test-helper.ts';
import { BARS, SONG_ID } from './store.test-helper.ts';

const OTHER_SONG_ID = SONG_ID + 1;
const SONG_SOUNDS = {
  normal: KB_SOUND_NAMES.length - 1,
  accent: KB_SOUND_NAMES.length - 2,
} as const;
const songSounds = [SONG_SOUNDS.normal, SONG_SOUNDS.accent];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a count with the click off', () => {
  async function songSoundsSet(): Promise<Song> {
    const song = await songWithCountIn(ONE_BAR, { click: false });
    song.store
      .getState()
      .setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    vi.clearAllMocks();
    return song;
  }

  const setSounds = (song: Song) => song.standalone.commands.setSounds;
  const standaloneSounds = (song: Song) => {
    const { normal, accent } = song.standalone.store.getState().sounds;
    return [normal, accent];
  };
  const startStandalone = (song: Song) => {
    song.standalone.store.getState().start();
  };

  async function countingWithSongSounds(): Promise<Song> {
    const song = await songSoundsSet();
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    return song;
  }

  it("plays the song's sounds, set before the count is scheduled", async () => {
    const song = await songSoundsSet();
    song.store.getState().togglePlay();
    expect(setSounds(song).mock.calls).toEqual([
      [SONG_SOUNDS.normal, SONG_SOUNDS.accent],
    ]);
    const [soundsAt] = setSounds(song).mock.invocationCallOrder;
    const [countAt] = song.commands.songCountIn.mock.invocationCallOrder;
    expect(soundsAt).toBeLessThan(countAt ?? 0);
  });

  it("keeps the song's sounds once the count is over until the standalone starts", async () => {
    const song = await songSoundsSet();
    song.store.getState().togglePlay();
    song.engine.now = countEnd(ONE_BAR);
    await vi.runAllTimersAsync();
    expect(setSounds(song)).toHaveBeenCalledOnce();
    startStandalone(song);
    expect(setSounds(song).mock.lastCall).toEqual(standaloneSounds(song));
  });

  const DROPS: readonly { name: string; drop: (song: Song) => void }[] = [
    {
      name: 'a pause',
      drop: (song) => {
        song.store.getState().togglePlay();
      },
    },
    {
      name: 'a stop from the notification',
      drop: (song) => {
        song.requestFromNotification({ action: 'stop', frame: null });
      },
    },
    {
      name: 'closing the song',
      drop: (song) => {
        song.store.getState().close();
      },
    },
    {
      name: 'opening another song',
      drop: (song) => {
        void song.store.getState().open(OTHER_SONG_ID, BARS);
      },
    },
  ];

  it.each(DROPS)(
    "gives the standalone's sounds back at once when $name ends the count",
    async ({ drop }) => {
      const song = await countingWithSongSounds();
      drop(song);
      expect(setSounds(song).mock.lastCall).toEqual(standaloneSounds(song));
    },
  );

  it("keeps the song's sounds when a seek counts in again", async () => {
    const song = await countingWithSongSounds();
    song.store.getState().seek(at(SEEK_IN_BAR_TWO));
    expect(counts(song)).toHaveLength(2);
    expect(setSounds(song).mock.calls).toEqual([songSounds, songSounds]);
  });

  it("keeps the song's sounds when a new grid counts in again", async () => {
    const song = await countingWithSongSounds();
    song.store.getState().meterOverrideChanged(SONG_ID, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await vi.runAllTimersAsync();
    expect(counts(song)).toHaveLength(2);
    expect(setSounds(song).mock.calls).toEqual([songSounds, songSounds]);
  });

  it("keeps the song's sounds when the click goes off mid-count", async () => {
    const song = await songWithCountIn();
    song.store.getState().togglePlay();
    await song.store.getState().toggleClick();
    expect(setSounds(song)).not.toHaveBeenCalled();
    song.engine.now = countEnd(ONE_BAR);
    await vi.runAllTimersAsync();
    expect(setSounds(song)).not.toHaveBeenCalled();
    startStandalone(song);
    expect(setSounds(song).mock.lastCall).toEqual(standaloneSounds(song));
  });
});
