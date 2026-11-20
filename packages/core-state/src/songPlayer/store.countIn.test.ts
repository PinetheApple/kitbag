import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { createMixerClick } from '../stemPlayer/mixerClick.ts';
import { at } from '../stemPlayer/store.test-helper.ts';
import {
  BAR_BEATS,
  BEAT,
  countEnd,
  counts,
  ONE_BAR,
  SEEK_IN_BAR_TWO,
  songWithCountIn,
  type Song,
} from './countIn.test-helper.ts';
import { createSongPlayerStore } from './store.ts';
import {
  BARS,
  fakeSongRuntime,
  opened,
  SONG_ID,
  songRecord,
} from './store.test-helper.ts';

const TWO_BARS = 2;
const MID_SONG = at(1.2);
const SONG_END = at(10);
const LATE_DOWNBEAT = 2;
const INTRO_BEATS = 16;
const INTRO_PAUSE = 3;
const INTRO_SEEK = 1;
const BAR_TWO = 2;
const introSong = () =>
  songRecord({
    durationSec: 12,
    beats: Array.from(
      { length: INTRO_BEATS + 2 * BAR_BEATS },
      (_, i) => i * BEAT,
    ),
    downbeatIndices: [INTRO_BEATS, INTRO_BEATS + BAR_BEATS],
  });

async function counting(): Promise<Song> {
  const song = await songWithCountIn();
  song.store.getState().togglePlay();
  await vi.runAllTimersAsync();
  return song;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('play from the start with a count-in', () => {
  it('counts the bars in, then starts the song where the count ends', async () => {
    const song = await counting();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[0]]);
    expect(counts(song)).toEqual([
      [countEnd(ONE_BAR), at(BEAT), BAR_BEATS, true],
    ]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBe(countEnd(ONE_BAR));
  });

  it("counts the song's own number of bars", async () => {
    const song = await songWithCountIn(TWO_BARS);
    song.store.getState().togglePlay();
    expect(counts(song)[0]?.[0]).toBe(countEnd(TWO_BARS));
  });

  it('starts the song on its first downbeat', async () => {
    const song = await songWithCountIn(ONE_BAR, {
      record: songRecord({
        downbeatIndices: [LATE_DOWNBEAT, LATE_DOWNBEAT + BAR_BEATS],
      }),
    });
    song.store.getState().togglePlay();
    expect(song.commands.mixerSeek.mock.calls).toEqual([
      [at(LATE_DOWNBEAT * BEAT)],
    ]);
    expect(counts(song)).toHaveLength(1);
  });

  it('counts in with the click off, keeping the click off after', async () => {
    const song = await songWithCountIn(ONE_BAR, { click: false });
    song.store.getState().togglePlay();
    expect(counts(song)).toEqual([
      [countEnd(ONE_BAR), at(BEAT), BAR_BEATS, false],
    ]);
  });

  it('counts in again when play starts the song over from its end', async () => {
    const song = await songWithCountIn();
    song.engine.position = SONG_END;
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('counts in again when play restarts a song that played to its end', async () => {
    const song = await counting();
    song.engine.now = countEnd(ONE_BAR);
    await vi.runAllTimersAsync();
    song.engine.position = SONG_END;
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(2);
  });

  it('counts in again after the song is closed and opened again', async () => {
    const song = await counting();
    song.store.getState().close();
    await song.store.getState().open(SONG_ID, BARS).loaded;
    song.store.getState().setClickCountIn(ONE_BAR);
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(2);
  });

  it('plays at once when the count-in is off', async () => {
    const song = await songWithCountIn(KB_COUNT_IN_OFF);
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });
});

describe('play after a pause', () => {
  it('resumes at once without counting in', async () => {
    const song = await songWithCountIn();
    song.engine.position = MID_SONG;
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });
});

describe('during the count', () => {
  it('pause cancels it and the song does not start', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('re-counts in the new meter when the grid is replaced', async () => {
    const song = await counting();
    song.store.getState().meterOverrideChanged(SONG_ID, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(counts(song).map((call) => call[2])).toEqual([
      BAR_BEATS,
      GRID_METER.triple,
    ]);
  });

  it('a pause from the notification cancels it', async () => {
    const song = await counting();
    song.requestFromNotification({ action: 'pause', frame: null });
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('shows the count on the notification', async () => {
    const song = await counting();
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ countingIn: true, playing: true }),
    );
  });

  it('a stop from the notification ends the song unstarted', async () => {
    const song = await counting();
    song.requestFromNotification({ action: 'stop', frame: null });
    song.stopSongFromNotification();
    expect(song.commands.songStop).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().songId).toBeNull();
  });
});

describe('a pause inside the intro', () => {
  async function pausedInIntro(): Promise<Song> {
    const song = await songWithCountIn(KB_COUNT_IN_OFF, {
      record: introSong(),
    });
    song.store.getState().togglePlay();
    song.engine.playing = true;
    song.engine.position = at(INTRO_PAUSE);
    song.store.getState().togglePlay();
    song.engine.playing = false;
    song.store.getState().setClickCountIn(ONE_BAR);
    vi.clearAllMocks();
    return song;
  }

  it('resumes where it paused without counting, though the count-in changed', async () => {
    const song = await pausedInIntro();
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('counts in after a seek earlier in the intro', async () => {
    const song = await pausedInIntro();
    song.store.getState().seek(at(INTRO_SEEK));
    song.engine.position = at(INTRO_SEEK);
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('counts in after a seek back to the start', async () => {
    const song = await pausedInIntro();
    song.store.getState().seek(0);
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });
});

describe('changes during the count', () => {
  it('a library re-read with a new grid counts in again', async () => {
    const song = await opened(songRecord());
    song.player.getState().setClickCountIn(ONE_BAR);
    vi.clearAllMocks();
    song.player.getState().togglePlay();
    song.records.readSong.mockResolvedValue(
      songRecord({ downbeatIndices: [1, 1 + BAR_BEATS] }),
    );
    song.library.setState({ rows: [songRow({ id: SONG_ID })] });
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(2);
  });

  it('turning the click off and on counts in again with the new click', async () => {
    const song = await counting();
    await song.store.getState().toggleClick();
    await song.store.getState().toggleClick();
    expect(counts(song).map((call) => call[3])).toEqual([true, false, true]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('Play on the standalone metronome starts the song at once', async () => {
    const fake = fakeSongRuntime();
    const click = createMixerClick();
    const store = createSongPlayerStore(() => fake.runtime, {
      metronome: fake.metronome,
      mixerClick: click,
    });
    await store.getState().open(SONG_ID, BARS).loaded;
    store.getState().setClickCountIn(ONE_BAR);
    store.getState().togglePlay();
    click.release();
    expect(fake.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(store.getState().countEndFrame).toBeNull();
  });

  it('closing stops the song unstarted without stopping the mixer', async () => {
    const song = await counting();
    song.store.getState().close();
    expect(song.commands.songStop).toHaveBeenCalledOnce();
    expect(song.commands.mixerStop).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('a seek counts in again from the bar it lands in', async () => {
    const song = await counting();
    song.store.getState().seek(at(SEEK_IN_BAR_TWO));
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerSeek.mock.calls).toEqual([
      [0],
      [at(SEEK_IN_BAR_TWO)],
      [at(BAR_TWO)],
    ]);
    expect(counts(song)).toHaveLength(2);
  });
});
